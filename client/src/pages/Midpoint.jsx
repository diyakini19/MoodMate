import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import { useMergedPlan, usePlan } from "../context/PlanContext";
import { travelApi } from "../services/api";
import AppHeader from "../components/AppHeader";

import Map from "ol/Map";
import View from "ol/View";

import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";

import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";

import Feature from "ol/Feature";

import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";

import {
  fromLonLat,
} from "ol/proj";

import {
  Style,
  Circle as CircleStyle,
  Fill,
  Stroke,
  Text,
} from "ol/style";

import "ol/ol.css";
import "./Midpoint.css";


/*
=========================================================
HELPER
=========================================================
*/

const isValidCoordinate = (
  lat,
  lng
) => {
  return (
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng))
  );
};


/*
=========================================================
MAIN COMPONENT
=========================================================
*/

export default function Midpoint() {

  const navigate = useNavigate();
  const { updatePlan } = usePlan();

  /*
  ========================================================
  MAP REFERENCES
  ========================================================
  */

  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const vectorSourceRef = useRef(null);


  /*
  ========================================================
  STATE
  ========================================================
  */

  const [midpoint, setMidpoint] =
    useState(null);

  const [
    selectedStartLocation,
    setSelectedStartLocation,
  ] = useState("");

  const [midpointName, setMidpointName] =
    useState("");

  const [
    geocodedLocations,
    setGeocodedLocations,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [transportInfo, setTransportInfo] =
    useState("");

  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] =
    useState(false);

  // How spread out the group is ("ok" | "wide" | "too_far"), from the server.
  const [spread, setSpread] = useState(null);

  // Set when the midpoint was moved onto the nearest named place.
  const [adjustment, setAdjustment] = useState(null);

  // The calculated halfway point, kept so users can switch back to it.
  const [halfwayPoint, setHalfwayPoint] = useState(null);

  // Name of the member whose area was picked instead of the halfway point.
  const [meetingChoice, setMeetingChoice] = useState("");


  /*
  ========================================================
  DATA FROM PREVIOUS PAGE
  ========================================================
  */

  const incomingData =
    useMergedPlan();

  const members =
    Array.isArray(
      incomingData.members
    )
      ? incomingData.members
      : [];

  const travelMode =
    incomingData.travelMode ||
    "private";

  const mood =
    incomingData.mood ||
    "";

  const memberCount =
    incomingData.memberCount ||
    members.length;

  const locationMode =
    incomingData.locationMode ||
    "";

  const currentLocation =
    incomingData.currentLocation ||
    "";

  const budget =
    incomingData.budget ||
    "";

  const vibes =
    incomingData.vibes ||
    [];


  /*
  ========================================================
  GEOCODE LOCATION
  ========================================================
  */

  const geocodeLocation =
    async (place) => {

      try {

        const data =
          await travelApi.geocode(
            place
          );

        if (
          !data ||
          !data.success ||
          !isValidCoordinate(
            data.lat,
            data.lng
          )
        ) {
          return null;
        }

        return {
          lat:
            Number(data.lat),

          lng:
            Number(data.lng),

          displayName:
            data.displayName ||
            place,
        };

      } catch (err) {

        console.error(
          "Geocoding error:",
          err
        );

        return null;
      }
    };


  /*
  ========================================================
  GEOCODE ALL MEMBERS
  ========================================================
  */

  const processMemberLocations =
    async () => {

      const results = [];

      for (
        let i = 0;
        i < members.length;
        i++
      ) {

        const member =
          members[i];

        const locationText =
          member.location ||
          member.address ||
          member.place ||
          member.currentLocation;

        if (!locationText) {
          continue;
        }

        const coordinates =
          await geocodeLocation(
            locationText
          );

        if (!coordinates) {
          continue;
        }

        results.push({

          ...member,

          name:
            member.name ||
            `Member ${i + 1}`,

          location:
            locationText,

          lat:
            coordinates.lat,

          lng:
            coordinates.lng,

          displayName:
            coordinates.displayName,

        });
      }

      return results;
    };


  /*
  ========================================================
  REVERSE GEOCODE
  ========================================================
  */

  const reverseGeocode =
    async (
      lat,
      lng
    ) => {

      try {

        const data =
          await travelApi.reverseGeocode(
            lat,
            lng
          );

        if (
          data &&
          data.success &&
          data.displayName
        ) {

          return data.displayName;
        }

        return "Smart Midpoint";

      } catch (err) {

        console.error(
          "Reverse geocoding error:",
          err
        );

        return "Smart Midpoint";
      }
    };


  /*
  ========================================================
  CALCULATE MEETING POINT
  ========================================================
  */

  const calculateMeetingPoint =
    async (locations) => {

      try {

        const data =
          await travelApi.calculate({
            locations,
            travelMode,
          });

        if (
          !data.success ||
          !data.meetingPoint
        ) {

          throw new Error(
            data.message ||
              "Unable to calculate meeting point."
          );
        }

        return data;

      } catch (err) {

        console.error(
          "Travel Engine error:",
          err
        );

        throw err;
      }
    };


  /*
  ========================================================
  TOGETHER MODE
  ========================================================
  */

  const processTogetherLocation =
    async () => {

      if (!currentLocation) {

        throw new Error(
          "Your current location was not found. Please go back and select your location again."
        );
      }

      const parts =
        currentLocation
          .split(",")
          .map((item) =>
            Number(item.trim())
          );

      if (
        parts.length !== 2 ||
        !Number.isFinite(parts[0]) ||
        !Number.isFinite(parts[1])
      ) {

        throw new Error(
          "The current location is invalid. Please go back and detect your location again."
        );
      }

      const lat =
        parts[0];

      const lng =
        parts[1];

      const locationPoint = {

        name:
          "Your Group",

        location:
          currentLocation,

        displayName:
          "Current group location",

        lat,

        lng,

      };

      setGeocodedLocations([
        locationPoint,
      ]);

      setSelectedStartLocation(
        currentLocation
      );

      setMidpoint({
        lat,
        lng,
      });

      const name =
        await reverseGeocode(
          lat,
          lng
        );

      setMidpointName(name);

      updatePlan({
        ...incomingData,
        midpoint: {
          lat,
          lng,
          name,
        },
        midpointName: name,
        startLocation: currentLocation,
        members: [locationPoint],
      });

      if (
        travelMode === "public"
      ) {

        setTransportInfo(
          "Everyone is already together. Public transport recommendations will be based around your current location."
        );

      } else {

        setTransportInfo(
          "Everyone is already together. Private vehicle recommendations will be based around your current location."
        );
      }
    };


  /*
  ========================================================
  DIFFERENT LOCATIONS
  ========================================================
  */

  const processDifferentLocations =
    async () => {

      const results =
        await processMemberLocations();

      if (
        results.length === 0
      ) {

        throw new Error(
          "Unable to find any of the member locations. Please check the locations and try again."
        );
      }

      setGeocodedLocations(
        results
      );

      setSelectedStartLocation(
        results[0].location
      );

      const travelResult =
        await calculateMeetingPoint(
          results
        );

      const calculatedMidpoint =
        travelResult.meetingPoint;

      if (
        !calculatedMidpoint ||
        !isValidCoordinate(
          calculatedMidpoint.lat,
          calculatedMidpoint.lng
        )
      ) {

        throw new Error(
          "The server returned an invalid meeting point."
        );
      }

      const midpointData = {

        lat:
          Number(
            calculatedMidpoint.lat
          ),

        lng:
          Number(
            calculatedMidpoint.lng
          ),

      };

      setMidpoint(
        midpointData
      );

      setSpread(travelResult.spread || null);
      setAdjustment(travelResult.adjustment || null);

      if (
        travelMode === "public"
      ) {

        setTransportInfo(
          "Your group's midpoint has been calculated. Nearby public transport will be searched around this exact location."
        );

      } else {

        setTransportInfo(
          travelResult.description ||
            "A central private vehicle meeting point has been calculated."
        );
      }

      const name =
        await reverseGeocode(
          midpointData.lat,
          midpointData.lng
        );

      setMidpointName(name);

      setHalfwayPoint({
        ...midpointData,
        name,
      });

      updatePlan({
        ...incomingData,
        members: results,
        startLocation: results[0].location,
        midpoint: {
          ...midpointData,
          name,
        },
        midpointName: name,
      });
    };


  /*
  ========================================================
  MEET IN ONE PERSON'S AREA INSTEAD
  ========================================================
  */

  const shortPlaceName = (member) =>
    String(
      member?.location ||
        member?.displayName ||
        member?.name ||
        ""
    ).split(",")[0];

  const meetInMemberArea = (member) => {
    const point = {
      lat: Number(member.lat),
      lng: Number(member.lng),
    };
    const name =
      member.displayName ||
      member.location ||
      `${member.name}'s area`;

    setMidpoint(point);
    setMidpointName(name);
    setMeetingChoice(member.name || shortPlaceName(member));

    updatePlan({
      midpoint: {
        ...point,
        name,
      },
      midpointName: name,
    });
  };

  const restoreHalfwayPoint = () => {
    if (!halfwayPoint) {
      return;
    }

    const { name, ...point } = halfwayPoint;

    setMidpoint(point);
    setMidpointName(name);
    setMeetingChoice("");

    updatePlan({
      midpoint: halfwayPoint,
      midpointName: name,
    });
  };


  /*
  ========================================================
  WEATHER AT MIDPOINT
  ========================================================
  */

  useEffect(() => {
    let cancelled = false;

    const loadWeather = async () => {
      if (midpoint?.lat == null || midpoint?.lng == null) {
        setWeather(null);
        return;
      }

      try {
        setWeatherLoading(true);
        const result = await travelApi.weather(
          midpoint.lat,
          midpoint.lng
        );

        if (cancelled) {
          return;
        }

        const nextWeather = result.weather || null;
        setWeather(nextWeather);

        if (nextWeather) {
          updatePlan({
            midpoint: {
              ...(incomingData.midpoint || {}),
              lat: midpoint.lat,
              lng: midpoint.lng,
              name: midpointName || incomingData.midpoint?.name || "",
              weather: nextWeather,
            },
          });
        }
      } catch (weatherError) {
        console.warn("Weather lookup failed:", weatherError);
        if (!cancelled) {
          setWeather(null);
        }
      } finally {
        if (!cancelled) {
          setWeatherLoading(false);
        }
      }
    };

    loadWeather();

    return () => {
      cancelled = true;
    };
  }, [midpoint?.lat, midpoint?.lng]);

  /*
  ========================================================
  PROCESS LOCATIONS
  ========================================================
  */

  useEffect(() => {

    let cancelled = false;

    const processLocations =
      async () => {

        setLoading(true);
        setError("");

        try {

          if (
            locationMode ===
            "together"
          ) {

            await processTogetherLocation();

          } else if (
            locationMode ===
            "different"
          ) {

            await processDifferentLocations();

          } else {

            throw new Error(
              "Location mode was not selected."
            );
          }

        } catch (err) {

          console.error(
            "Midpoint error:",
            err
          );

          if (!cancelled) {

            setError(
              err.message ||
                "Something went wrong while calculating the meeting point."
            );
          }

        } finally {

          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    processLocations();

    return () => {
      cancelled = true;
    };

  }, []);


  /*
  ========================================================
  OPENLAYERS MAP
  ========================================================
  */

  useEffect(() => {

    /*
    --------------------------------------------------------
    DO NOT CREATE MAP UNTIL DATA EXISTS
    --------------------------------------------------------
    */

    if (
      loading ||
      !mapElementRef.current ||
      !midpoint ||
      geocodedLocations.length === 0
    ) {
      return;
    }


    /*
    --------------------------------------------------------
    REMOVE PREVIOUS MAP
    --------------------------------------------------------
    */

    if (mapInstanceRef.current) {

      try {

        mapInstanceRef.current.setTarget(
          null
        );

      } catch (err) {

        console.warn(
          "Unable to remove previous OpenLayers map:",
          err
        );
      }

      mapInstanceRef.current =
        null;
    }


    /*
    --------------------------------------------------------
    CREATE VECTOR SOURCE
    --------------------------------------------------------
    */

    const vectorSource =
      new VectorSource();

    vectorSourceRef.current =
      vectorSource;


    /*
    --------------------------------------------------------
    VECTOR LAYER
    --------------------------------------------------------
    */

    const vectorLayer =
      new VectorLayer({

        source:
          vectorSource,

    });


    /*
    ========================================================
    MEMBER MARKERS
    ========================================================
    */

    const allCoordinates = [];


    geocodedLocations.forEach(
      (member, index) => {

        const lat =
          Number(member.lat);

        const lng =
          Number(member.lng);

        if (
          !isValidCoordinate(
            lat,
            lng
          )
        ) {
          return;
        }

        const coordinate =
          fromLonLat([
            lng,
            lat,
          ]);

        allCoordinates.push(
          coordinate
        );


        /*
        ----------------------------------------------------
        MEMBER FEATURE
        ----------------------------------------------------
        */

        const memberFeature =
          new Feature({

            geometry:
              new Point(
                coordinate
              ),

          });


        /*
        ----------------------------------------------------
        MEMBER STYLE
        ----------------------------------------------------
        */

        memberFeature.setStyle(

          new Style({

            image:
              new CircleStyle({

                radius:
                  20,

                fill:
                  new Fill({
                    color:
                      "#8b5cf6",
                  }),

                stroke:
                  new Stroke({

                    color:
                      "#ffffff",

                    width:
                      3,

                  }),

              }),

            text:
              new Text({

                text:
                  String(index + 1),

                fill:
                  new Fill({

                    color:
                      "#ffffff",

                  }),

                font:
                  "bold 14px Arial",

              }),

          })

        );


        /*
        ----------------------------------------------------
        ADD MEMBER
        ----------------------------------------------------
        */

        vectorSource.addFeature(
          memberFeature
        );


        /*
        ====================================================
        CONNECTION LINE
        ====================================================
        */

        const midpointCoordinate =
          fromLonLat([
            Number(midpoint.lng),
            Number(midpoint.lat),
          ]);


        const lineFeature =
          new Feature({

            geometry:
              new LineString([
                coordinate,
                midpointCoordinate,
              ]),

          });


        lineFeature.setStyle(

          new Style({

            stroke:
              new Stroke({

                color:
                  "#9b6cff",

                width:
                  3,

                lineDash:
                  [8, 8],

              }),

          })

        );


        vectorSource.addFeature(
          lineFeature
        );

      }
    );


    /*
    ========================================================
    MIDPOINT
    ========================================================
    */

    const midpointCoordinate =
      fromLonLat([
        Number(midpoint.lng),
        Number(midpoint.lat),
      ]);

    allCoordinates.push(
      midpointCoordinate
    );


    const midpointFeature =
      new Feature({

        geometry:
          new Point(
            midpointCoordinate
          ),

      });


    midpointFeature.setStyle(

      new Style({

        image:
          new CircleStyle({

            radius:
              25,

            fill:
              new Fill({

                color:
                  "#5d43a6",

              }),

            stroke:
              new Stroke({

                color:
                  "#ffffff",

                width:
                  4,

              }),

          }),

        text:
          new Text({

            text:
              "★",

            fill:
              new Fill({

                color:
                  "#ffffff",

              }),

            font:
              "bold 20px Arial",

          }),

      })

    );


    vectorSource.addFeature(
      midpointFeature
    );


    /*
    ========================================================
    OPENSTREETMAP BASE LAYER
    ========================================================
    */

    const osmLayer =
      new TileLayer({

        source:
          new OSM(),

      });


    /*
    ========================================================
    CREATE OPENLAYERS MAP
    ========================================================
    */

    const map =
      new Map({

        target:
          mapElementRef.current,

        layers: [
          osmLayer,
          vectorLayer,
        ],

        view:
          new View({

            center:
              midpointCoordinate,

            zoom:
              13,

          }),

      });


    mapInstanceRef.current =
      map;


    /*
    ========================================================
    FIT ALL LOCATIONS
    ========================================================
    */

    if (
      allCoordinates.length === 1
    ) {

      map.getView().setCenter(
        midpointCoordinate
      );

      map.getView().setZoom(
        14
      );

    } else {

      const extent =
        vectorSource.getExtent();

      map.getView().fit(
        extent,
        {

          padding: [
            70,
            70,
            70,
            70,
          ],

          maxZoom:
            14,

          duration:
            500,

        }
      );
    }


    /*
    ========================================================
    IMPORTANT REFRESH FIX
    ========================================================
    */

    requestAnimationFrame(() => {

      if (
        mapInstanceRef.current
      ) {

        mapInstanceRef.current.updateSize();

      }

    });


    const timer1 =
      setTimeout(() => {

        if (
          mapInstanceRef.current
        ) {

          mapInstanceRef.current.updateSize();

        }

      }, 100);


    const timer2 =
      setTimeout(() => {

        if (
          mapInstanceRef.current
        ) {

          mapInstanceRef.current.updateSize();

        }

      }, 500);


    const timer3 =
      setTimeout(() => {

        if (
          mapInstanceRef.current
        ) {

          mapInstanceRef.current.updateSize();

        }

      }, 1000);


    /*
    ========================================================
    CLEANUP
    ========================================================
    */

    return () => {

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      if (
        mapInstanceRef.current
      ) {

        try {

          mapInstanceRef.current.setTarget(
            null
          );

        } catch (err) {

          console.warn(
            "OpenLayers cleanup error:",
            err
          );

        }

        mapInstanceRef.current =
          null;
      }

      vectorSourceRef.current =
        null;
    };

  }, [
    loading,
    midpoint,
    geocodedLocations,
  ]);


  /*
  ========================================================
  GET DIRECTIONS
  ========================================================
  */

  const handleGetDirections =
    () => {

      if (
        !selectedStartLocation ||
        !midpoint
      ) {
        return;
      }


      /*
      ------------------------------------------------------
      PUBLIC TRANSPORT
      ------------------------------------------------------
      */

      if (
        travelMode ===
        "public"
      ) {

        const nextPlan = {
          ...incomingData,
          startLocation: selectedStartLocation,
          midpoint: {
            lat: Number(midpoint.lat),
            lng: Number(midpoint.lng),
            name: midpointName,
          },
          midpointName,
          members: geocodedLocations.length ? geocodedLocations : members,
          memberCount,
          locationMode,
          travelMode,
        };

        updatePlan(nextPlan);
        navigate("/public-transport", {
          state: nextPlan,
        });

        return;
      }

      const nextPlan = {
        ...incomingData,
        startLocation: selectedStartLocation,
        midpoint: {
          lat: Number(midpoint.lat),
          lng: Number(midpoint.lng),
          name: midpointName,
        },
        midpointName,
        members: geocodedLocations.length ? geocodedLocations : members,
        memberCount,
        locationMode,
        travelMode,
      };

      updatePlan(nextPlan);
      navigate("/private-transport", {
        state: nextPlan,
      });
    };


  /*
  ========================================================
  RECOMMENDATIONS
  ========================================================
  */

  const handleRecommendations =
    () => {

      if (!midpoint) {
        return;
      }

      const nextPlan = {
        ...incomingData,
        mood,
        memberCount,
        locationMode,
        travelMode,
        currentLocation,
        members: geocodedLocations.length ? geocodedLocations : members,
        budget,
        vibes,
        midpoint: {
          lat: midpoint.lat,
          lng: midpoint.lng,
          name: midpointName,
        },
        midpointName,
      };

      updatePlan(nextPlan);
      navigate("/recommendations", {
        state: nextPlan,
      });
    };

  const handleBack = () => {
    navigate("/preferences", {
      state: {
        mood,
        memberCount,
        locationMode,
        travelMode,
        currentLocation,
        members,
        budget,
        vibes,
      },
    });
  };


  /*
  ========================================================
  LOADING SCREEN
  ========================================================
  */

  if (loading) {

    return (

      <div className="midpoint-page">

        <div className="midpoint-container">

          <div className="midpoint-loading">

            <div className="loading-icon">
              📍
            </div>

            <h2>
              Finding your perfect
              meeting point...
            </h2>

            <p>
              We're checking
              everyone's location
              and calculating a
              suitable meeting point.
            </p>

            <div className="loading-spinner"></div>

          </div>

        </div>

      </div>

    );
  }


  /*
  ========================================================
  ERROR SCREEN
  ========================================================
  */

  if (error) {

    return (

      <div className="midpoint-page app-page">
        <AppHeader onBack={handleBack} />

        <div className="midpoint-container app-page-main">

          <div className="midpoint-error">

            <div className="error-icon">
              ⚠️
            </div>

            <h2>
              Unable to find
              meeting point
            </h2>

            <p>
              {error}
            </p>

            <button
              className="continue-btn"
              onClick={() =>
                navigate(-1)
              }
            >
              ← Try Again
            </button>

          </div>

        </div>

      </div>

    );
  }


  const mustChooseMeetingArea =
    spread?.level === "too_far" && !meetingChoice;

  /*
  ========================================================
  MAIN PAGE
  ========================================================
  */

  return (

    <div className="midpoint-page app-page">
      <AppHeader onBack={handleBack} />

      <div className="midpoint-container app-page-main">

        {/* HEADER */}

        <div className="midpoint-header">

          <span className="small-label">
            STEP 4 OF 4
          </span>

          <h1>
            Your group's sweet spot
          </h1>

          <p>
            {mustChooseMeetingArea
              ? "Your group is far apart, so choose whose city to meet in."
              : "We found a meeting point that works for your group."}
          </p>

        </div>


        {/* GROUP SPREAD */}

        {spread && spread.level !== "ok" && (
          <div
            className={`spread-card ${
              spread.level === "too_far" ? "is-too-far" : "is-wide"
            }`}
            role={spread.level === "too_far" ? "alert" : "status"}
          >
            <div className="spread-card-icon">
              {spread.level === "too_far" ? "🌍" : "↔"}
            </div>

            <div className="spread-card-body">
              <strong>
                {spread.level === "too_far"
                  ? "Your group is too far apart to meet halfway"
                  : "Your group is quite spread out"}
              </strong>

              <p>{spread.message}</p>

              {meetingChoice ? (
                <p className="spread-choice">
                  {`✓ Meeting in ${meetingChoice}'s area${
                    midpointName ? ` (${midpointName.split(",")[0]})` : ""
                  }.`}
                </p>
              ) : (
                spread.level === "too_far" && (
                  <p className="spread-choice">
                    Pick where to meet to continue:
                  </p>
                )
              )}

              <div className="spread-options">
                {geocodedLocations.map((member, index) =>
                  meetingChoice === (member.name || shortPlaceName(member)) ? null : (
                    <button
                      key={`${member.name}-${index}`}
                      type="button"
                      className="spread-option-btn"
                      onClick={() => meetInMemberArea(member)}
                    >
                      Meet in {shortPlaceName(member)}
                      {member.name ? ` (${member.name})` : ""}
                    </button>
                  )
                )}

                {meetingChoice && spread.level === "wide" && (
                  <button
                    type="button"
                    className="spread-option-btn is-secondary"
                    onClick={restoreHalfwayPoint}
                  >
                    Back to the halfway point
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* RESULT CARD */}

        <div className="midpoint-result-card">

          <div className="result-icon">
            ★
          </div>

          <div className="result-content">

            <span className="result-label">
              {meetingChoice
                ? `MEETING IN ${meetingChoice.toUpperCase()}'S AREA`
                : "SMART MIDPOINT"}
            </span>

            <h2>

              {midpointName
                ? midpointName.split(",")[0]
                : "Your Perfect Meeting Point"}

            </h2>

            <p>

              {midpointName ||
                "Calculated meeting point"}

            </p>

            {!meetingChoice &&
              adjustment?.placeName &&
              adjustment.distanceKm >= 0.3 && (
                <p className="midpoint-adjust-note">
                  Moved {adjustment.distanceKm.toFixed(1)} km from the exact
                  halfway point to {adjustment.placeName}, so it's a real,
                  reachable place.
                </p>
              )}

          </div>

        </div>

        {(weatherLoading || weather) && (
          <div className="transport-info-card" style={{ marginTop: 16 }}>
            <div className="transport-info-icon">☁</div>
            <div>
              <strong>Weather at midpoint</strong>
              <p>
                {weatherLoading
                  ? "Checking conditions..."
                  : `${weather.summary}${
                      weather.temperatureC != null
                        ? ` · ${Math.round(weather.temperatureC)}°C`
                        : ""
                    }${
                      weather.windKph != null
                        ? ` · wind ${Math.round(weather.windKph)} km/h`
                        : ""
                    }`}
              </p>
            </div>
          </div>
        )}


        {/* TRANSPORT INFO */}

        {transportInfo && (

          <div className="transport-info-card">

            <div className="transport-info-icon">

              {travelMode ===
              "public"
                ? "🚌"
                : "🚗"}

            </div>

            <div>

              <strong>

                {travelMode ===
                "public"
                  ? "Public Transport"
                  : "Private Vehicle"}

              </strong>

              <p>
                {transportInfo}
              </p>

            </div>

          </div>

        )}


        {/* MAP */}

        <div className="map-section">

          <div className="map-header">

            <div>

              <h2>
                Group Map
              </h2>

              <p>
                Everyone's location
                and your calculated
                meeting point
              </p>

            </div>

            <div className="travel-mode-badge">

              {travelMode ===
              "public"
                ? "🚌 Public Transport"
                : "🚗 Private Transport"}

            </div>

          </div>


          <div className="map-wrapper">

            <div
              ref={mapElementRef}
              className="moodmate-map"
            />

          </div>

        </div>


        {/* LEGEND */}

        <div className="map-legend">

          <div className="legend-item">

            <span className="legend-member">
              1
            </span>

            <span>
              Group Member
            </span>

          </div>

          <div className="legend-item">

            <span className="legend-midpoint">
              ★
            </span>

            <span>
              Smart Midpoint
            </span>

          </div>

          <div className="legend-line"></div>

          <span>
            Connection to midpoint
          </span>

        </div>


        {/* MEMBERS */}

        <div className="members-section">

          <div className="section-heading">

            <div>

              <span className="small-label">
                YOUR GROUP
              </span>

              <h2>

                {geocodedLocations.length}{" "}

                {geocodedLocations.length ===
                1
                  ? "member"
                  : "members"}

              </h2>

            </div>

          </div>


          <div className="members-grid">

            {geocodedLocations.map(
              (
                member,
                index
              ) => (

                <div
                  className="member-card"
                  key={`${member.name}-${index}`}
                >

                  <div className="member-number">
                    {index + 1}
                  </div>

                  <div className="member-info">

                    <strong>
                      {member.name ||
                        `Member ${index + 1}`}
                    </strong>

                    <span>

                      📍{" "}

                      {member.location ||
                        member.displayName}

                    </span>

                  </div>

                </div>

              )
            )}

          </div>

        </div>


        {/* DIRECTIONS */}

        <div className="directions-section">

          {geocodedLocations.length > 1 && (

            <div
              style={{
                marginBottom:
                  "18px",

                textAlign:
                  "left",

                maxWidth:
                  "400px",

                marginLeft:
                  "auto",

                marginRight:
                  "auto",
              }}
            >

              <label
                style={{
                  display:
                    "block",

                  marginBottom:
                    "8px",

                  fontSize:
                    "12px",

                  fontWeight:
                    "700",

                  color:
                    "#77717d",
                }}
              >
                START DIRECTIONS FROM
              </label>


              <select
                value={
                  selectedStartLocation
                }
                onChange={(e) =>
                  setSelectedStartLocation(
                    e.target.value
                  )
                }
                style={{
                  width:
                    "100%",

                  padding:
                    "12px 14px",

                  borderRadius:
                    "12px",

                  border:
                    "1px solid #e4dff0",

                  background:
                    "white",

                  color:
                    "#24212a",

                  fontSize:
                    "13px",

                  outline:
                    "none",

                  cursor:
                    "pointer",

                  boxSizing:
                    "border-box",
                }}
              >

                {geocodedLocations.map(
                  (
                    member,
                    index
                  ) => (

                    <option
                      key={`${member.name}-${index}`}
                      value={
                        member.location
                      }
                    >

                      {member.name ||
                        `Member ${
                          index + 1
                        }`}{" "}

                      —{" "}

                      {member.location}

                    </option>

                  )
                )}

              </select>

            </div>

          )}


          {mustChooseMeetingArea ? (
            <p className="spread-blocked-note">
              Choose where to meet above to get directions and
              recommendations.
            </p>
          ) : (
            <>
              {/* GET DIRECTIONS */}

              <button
                className="directions-btn"
                onClick={
                  handleGetDirections
                }
                type="button"
              >
                🧭 Get Directions
                to Midpoint
              </button>


              {/* RECOMMENDATIONS */}

              <button
                className="recommendations-btn"
                onClick={
                  handleRecommendations
                }
                type="button"
              >
                ✨ Find Recommendations
              </button>
            </>
          )}


          <p>
            Choose a starting location
            and get directions to your
            group's midpoint.
          </p>

        </div>

      </div>

    </div>

  );
}