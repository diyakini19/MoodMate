import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

import { fromLonLat } from "ol/proj";

import Style from "ol/style/Style";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Text from "ol/style/Text";

import "ol/ol.css";
import "./PublicTransport.css";

export default function PublicTransport() {
  const navigate = useNavigate();
  const { updatePlan } = usePlan();
  const plan = useMergedPlan();

  const {
    startLocation = "",
    midpoint = {},
    members = [],
    mood,
    memberCount,
    locationMode,
    travelMode,
    currentLocation,
    budget,
    vibes,
  } = plan;

  /*
   * =========================================================
   * REFS
   * =========================================================
   */

  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const vectorSourceRef = useRef(null);

  /*
   * =========================================================
   * STATE
   * =========================================================
   */

  const [transportData, setTransportData] = useState(null);

  const [selectedType, setSelectedType] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  /*
   * =========================================================
   * MIDPOINT COORDINATES
   * =========================================================
   */

  const midpointLat = Number(midpoint?.lat);
  const midpointLng = Number(midpoint?.lng);

  const hasMidpoint =
    Number.isFinite(midpointLat) &&
    Number.isFinite(midpointLng);

  const midpointName =
    midpoint?.name || "Smart Midpoint";

  /*
   * =========================================================
   * VALID MEMBERS
   * =========================================================
   */

  const planMembers = plan.members;

  const validMembers = useMemo(
    () =>
      Array.isArray(planMembers)
        ? planMembers.filter(
            (member) =>
              Number.isFinite(Number(member?.lat)) &&
              Number.isFinite(Number(member?.lng))
          )
        : [],
    [planMembers]
  );

  /*
   * =========================================================
   * LOAD PUBLIC TRANSPORT DATA
   * =========================================================
   */

  useEffect(() => {
    let cancelled = false;

    const loadTransportInformation = async () => {
      /*
       * Midpoint is required.
       */

      if (!hasMidpoint) {
        setError(
          "Midpoint location is not available."
        );

        return;
      }

      /*
       * Use member locations if available.
       * Otherwise use midpoint.
       */

      const locations =
        validMembers.length > 0
          ? validMembers
          : [
              {
                name: "Group Midpoint",
                lat: midpointLat,
                lng: midpointLng,
              },
            ];

      setLoading(true);
      setError("");

      try {
        const data = await travelApi.publicTransport({
          locations,
          midpoint: {
            lat: midpointLat,
            lng: midpointLng,
            name: midpointName,
          },
        });

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Unable to load public transport information."
          );
        }

        if (!cancelled) {
          setTransportData(
            data.transport || null
          );
        }
      } catch (err) {
        console.error(
          "Public transport error:",
          err
        );

        if (!cancelled) {
          setError(
            !err?.message || /fetch failed|network/i.test(err.message)
              ? "Live public transport data is temporarily unavailable. Please try again in a moment."
              : err.message
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadTransportInformation();

    return () => {
      cancelled = true;
    };
  }, [
    hasMidpoint,
    midpointLat,
    midpointLng,
    validMembers.length,
    reloadKey,
  ]);

  /*
   * =========================================================
   * CREATE OPENLAYERS MAP
   * =========================================================
   */

  useEffect(() => {
    /*
     * Do not create map until midpoint exists
     * and DOM container is available (the loading
     * screen does not render the map container).
     */

    if (
      loading ||
      !mapElementRef.current ||
      !hasMidpoint
    ) {
      return;
    }

    /*
     * If an old map exists, remove it first.
     */

    if (mapRef.current) {
      mapRef.current.setTarget(null);
      mapRef.current = null;
    }

    /*
     * VECTOR SOURCE
     */

    const vectorSource =
      new VectorSource();

    vectorSourceRef.current =
      vectorSource;

    /*
     * VECTOR LAYER
     */

    const vectorLayer =
      new VectorLayer({
        source: vectorSource,
      });

    /*
     * =========================================================
     * OPENSTREETMAP BASE MAP
     * =========================================================
     */

    const osmLayer =
      new TileLayer({
        source: new OSM(),
      });

    /*
     * =========================================================
     * CREATE MAP
     * =========================================================
     */

    const map =
      new Map({
        target: mapElementRef.current,

        layers: [
          osmLayer,
          vectorLayer,
        ],

        view: new View({
          center: fromLonLat([
            midpointLng,
            midpointLat,
          ]),

          zoom: 13,

          minZoom: 3,

          maxZoom: 19,
        }),
      });

    mapRef.current = map;

    /*
     * =========================================================
     * MEMBER MARKERS
     * =========================================================
     */

    validMembers.forEach(
      (member, index) => {
        const lat =
          Number(member.lat);

        const lng =
          Number(member.lng);

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          return;
        }

        const coordinate =
          fromLonLat([
            lng,
            lat,
          ]);

        /*
         * Member feature
         */

        const feature =
          new Feature({
            geometry:
              new Point(
                coordinate
              ),
          });

        /*
         * Member marker style
         */

        feature.setStyle(
          new Style({
            image:
              new CircleStyle({
                radius: 15,

                fill:
                  new Fill({
                    color: "#8b5cf6",
                  }),

                stroke:
                  new Stroke({
                    color: "#ffffff",
                    width: 3,
                  }),
              }),

            text:
              new Text({
                text: String(
                  index + 1
                ),

                font:
                  "bold 13px Arial",

                fill:
                  new Fill({
                    color: "#ffffff",
                  }),

                textAlign: "center",

                textBaseline:
                  "middle",
              }),
          })
        );

        feature.set(
          "type",
          "member"
        );

        feature.set(
          "name",
          member.name ||
            `Member ${index + 1}`
        );

        vectorSource.addFeature(
          feature
        );

        /*
         * Connection line
         */

        const line =
          new Feature({
            geometry:
              new LineString([
                coordinate,

                fromLonLat([
                  midpointLng,
                  midpointLat,
                ]),
              ]),
          });

        line.setStyle(
          new Style({
            stroke:
              new Stroke({
                color:
                  "#9b6cff",

                width: 3,

                lineDash: [
                  8,
                  8,
                ],

                lineCap:
                  "round",
              }),
          })
        );

        line.set(
          "type",
          "connection"
        );

        vectorSource.addFeature(
          line
        );
      }
    );

    /*
     * =========================================================
     * MIDPOINT MARKER
     * =========================================================
     */

    const midpointFeature =
      new Feature({
        geometry:
          new Point(
            fromLonLat([
              midpointLng,
              midpointLat,
            ])
          ),
      });

    midpointFeature.setStyle(
      new Style({
        image:
          new CircleStyle({
            radius: 20,

            fill:
              new Fill({
                color: "#6d45d8",
              }),

            stroke:
              new Stroke({
                color: "#ffffff",
                width: 4,
              }),
          }),

        text:
          new Text({
            text: "★",

            font:
              "bold 20px Arial",

            fill:
              new Fill({
                color: "#ffffff",
              }),

            textAlign: "center",

            textBaseline:
              "middle",
          }),
      })
    );

    midpointFeature.set(
      "type",
      "midpoint"
    );

    midpointFeature.set(
      "name",
      midpointName
    );

    vectorSource.addFeature(
      midpointFeature
    );

    /*
     * =========================================================
     * FIT MAP TO ALL LOCATIONS
     * =========================================================
     */

    const allCoordinates = [];

    /*
     * Members
     */

    validMembers.forEach(
      (member) => {
        const lat =
          Number(member.lat);

        const lng =
          Number(member.lng);

        if (
          Number.isFinite(lat) &&
          Number.isFinite(lng)
        ) {
          allCoordinates.push(
            fromLonLat([
              lng,
              lat,
            ])
          );
        }
      }
    );

    /*
     * Midpoint
     */

    allCoordinates.push(
      fromLonLat([
        midpointLng,
        midpointLat,
      ])
    );

    /*
     * If only midpoint exists
     */

    if (
      allCoordinates.length === 1
    ) {
      map.getView().setCenter(
        allCoordinates[0]
      );

      map.getView().setZoom(
        14
      );
    } else {
      /*
       * Calculate extent
       */

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

          maxZoom: 14,

          duration: 500,
        }
      );
    }

    /*
     * =========================================================
     * FIX MAP SIZE
     * =========================================================
     */

    const resizeMap =
      () => {
        if (mapRef.current) {
          mapRef.current.updateSize();
        }
      };

    setTimeout(
      resizeMap,
      100
    );

    setTimeout(
      resizeMap,
      500
    );

    setTimeout(
      resizeMap,
      1000
    );

    /*
     * Window resize
     */

    window.addEventListener(
      "resize",
      resizeMap
    );

    /*
     * =========================================================
     * CLEANUP
     * =========================================================
     */

    return () => {
      window.removeEventListener(
        "resize",
        resizeMap
      );

      if (mapRef.current) {
        mapRef.current.setTarget(
          null
        );

        mapRef.current = null;
      }

      vectorSourceRef.current =
        null;
    };
  }, [
    loading,
    hasMidpoint,
    midpointLat,
    midpointLng,
    midpointName,
    validMembers,
  ]);

  /*
   * =========================================================
   * SELECTED RESULTS
   * =========================================================
   */

  const getSelectedResults =
    () => {
      if (
        !transportData ||
        !selectedType
      ) {
        return [];
      }

      if (
        selectedType === "bus"
      ) {
        return (
          transportData?.bus
            ?.stops || []
        );
      }

      if (
        selectedType === "train"
      ) {
        return (
          transportData?.train
            ?.stations || []
        );
      }

      if (
        selectedType === "metro"
      ) {
        return (
          transportData?.metro
            ?.stations || []
        );
      }

      return [];
    };

  const selectedResults =
    getSelectedResults();

  const countLabel = (count, noun) =>
    transportData
      ? `${count || 0} nearby ${noun}`
      : "Unavailable right now";

  /*
   * =========================================================
   * TRANSPORT SELECTION
   * =========================================================
   */

  const handleSelectTransport =
    (type) => {
      setSelectedType(type);
      setError("");
    };

  /*
   * =========================================================
   * TRANSPORT TITLE
   * =========================================================
   */

  const getTransportTitle =
    () => {
      if (
        selectedType === "bus"
      ) {
        return "Nearby Bus Stops";
      }

      if (
        selectedType === "train"
      ) {
        return "Nearby Railway Stations";
      }

      if (
        selectedType === "metro"
      ) {
        return "Nearby Metro Stations";
      }

      return "Public Transport Options";
    };

  /*
   * =========================================================
   * TRANSPORT DESCRIPTION
   * =========================================================
   */

  const getTransportDescription =
    () => {
      if (
        selectedType === "bus"
      ) {
        return "Bus stops near your group's midpoint.";
      }

      if (
        selectedType === "train"
      ) {
        return "Railway stations near your group's midpoint.";
      }

      if (
        selectedType === "metro"
      ) {
        return "Metro stations near your group's midpoint.";
      }

      return "Choose a transport option to see nearby locations.";
    };

  /*
   * =========================================================
   * LOADING SCREEN
   * =========================================================
   */

  if (loading) {
    return (
      <div className="public-transport-page app-page">
        <AppHeader
          onBack={() => navigate("/midpoint", { state: plan })}
        />

        <div className="public-transport-container app-page-main">

          <div className="pt-header">

            <span className="pt-small-label">
              PUBLIC TRANSPORT
            </span>

            <h1>
              Finding transport nearby...
            </h1>

            <p>
              We're checking bus stops,
              railway stations and metro
              stations around your midpoint.
            </p>

          </div>

          <div
            style={{
              textAlign: "center",
              padding: "50px 20px",
            }}
          >
            <div
              style={{
                fontSize: "42px",
                marginBottom: "15px",
              }}
            >
              🚏
            </div>

            <div className="loading-spinner"></div>

            <p>
              Finding nearby public
              transport...
            </p>
          </div>

        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * MAIN PAGE
   * =========================================================
   */

  return (
    <div className="public-transport-page app-page">
      <AppHeader
        onBack={() => navigate("/midpoint", { state: plan })}
      />

      <div className="public-transport-container app-page-main">

        {/* HEADER */}

        <div className="pt-header">

          <span className="pt-small-label">
            PUBLIC TRANSPORT
          </span>

          <h1>
            How do you want to travel?
          </h1>

          <p>
            Choose a public transport option
            to reach your group's midpoint.
          </p>

        </div>

        {/* ROUTE */}

        <div className="pt-route-card">

          <div className="pt-location">

            <div className="pt-icon pt-start-icon">
              📍
            </div>

            <div>

              <span>
                STARTING FROM
              </span>

              <strong>
                {startLocation ||
                  "Group member locations"}
              </strong>

            </div>

          </div>

          <div className="pt-route-line">
            ↓
          </div>

          <div className="pt-location">

            <div className="pt-icon pt-destination-icon">
              ★
            </div>

            <div>

              <span>
                DESTINATION
              </span>

              <strong>
                {midpointName}
              </strong>

            </div>

          </div>

        </div>

        {/* =================================================
            MAP
        ================================================= */}

        <section
          className="pt-map-section"
        >

          <div
            className="pt-map-header"
          >

            <div>

              <span>
                GROUP LOCATION
              </span>

              <h2>
                Your group's midpoint
              </h2>

              <p>
                Everyone's location and
                calculated meeting point.
              </p>

            </div>

            <div
              className="pt-map-badge"
            >
              OpenStreetMap
            </div>

          </div>

          <div
            className="pt-map-wrapper"
          >

            <div
              ref={mapElementRef}
              className="pt-openlayers-map"
            />

          </div>

          <div
            className="pt-map-legend"
          >

            <div>
              <span className="pt-legend-member">
                1
              </span>

              Group member
            </div>

            <div>
              <span className="pt-legend-midpoint">
                ★
              </span>

              Group midpoint
            </div>

          </div>

        </section>

        {/* ERROR */}

        {error && (
          <div className="pt-error" role="alert">
            <span>⚠️ {error}</span>
            {hasMidpoint && (
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Try again
              </button>
            )}
          </div>
        )}

        {/* OPTIONS */}

        <div className="pt-options">

          <h2>
            Public Transport Options
          </h2>

          <p>
            Select an option to see nearby
            transport information.
          </p>

          {/* BUS */}

          <button
            className={`pt-option-card ${
              selectedType === "bus"
                ? "pt-option-selected"
                : ""
            }`}
            type="button"
            onClick={() =>
              handleSelectTransport(
                "bus"
              )
            }
          >

            <div className="pt-option-icon">
              🚌
            </div>

            <div className="pt-option-content">

              <strong>
                Bus
              </strong>

              <span>
                {countLabel(transportData?.bus?.count, "bus stops")}
              </span>

            </div>

            <div className="pt-arrow">
              →
            </div>

          </button>

          {/* TRAIN */}

          <button
            className={`pt-option-card ${
              selectedType === "train"
                ? "pt-option-selected"
                : ""
            }`}
            type="button"
            onClick={() =>
              handleSelectTransport(
                "train"
              )
            }
          >

            <div className="pt-option-icon">
              🚆
            </div>

            <div className="pt-option-content">

              <strong>
                Train
              </strong>

              <span>
                {countLabel(transportData?.train?.count, "railway stations")}
              </span>

            </div>

            <div className="pt-arrow">
              →
            </div>

          </button>

          {/* METRO */}

          <button
            className={`pt-option-card ${
              selectedType === "metro"
                ? "pt-option-selected"
                : ""
            }`}
            type="button"
            onClick={() =>
              handleSelectTransport(
                "metro"
              )
            }
          >

            <div className="pt-option-icon">
              🚇
            </div>

            <div className="pt-option-content">

              <strong>
                Metro
              </strong>

              <span>
                {countLabel(transportData?.metro?.count, "metro stations")}
              </span>

            </div>

            <div className="pt-arrow">
              →
            </div>

          </button>

        </div>

        {/* =================================================
            RESULTS
        ================================================= */}

        {selectedType && (
          <div
            style={{
              marginTop: "28px",
            }}
          >

            <div
              style={{
                marginBottom: "18px",
              }}
            >

              <h2
                style={{
                  margin:
                    "0 0 6px",
                  color:
                    "#24212a",
                }}
              >
                {getTransportTitle()}
              </h2>

              <p
                style={{
                  margin: 0,
                  color:
                    "#77717d",
                  fontSize:
                    "14px",
                }}
              >
                {getTransportDescription()}
              </p>

            </div>

            {/* NO RESULTS */}

            {selectedResults.length ===
              0 && (
              <div
                style={{
                  padding:
                    "30px 20px",
                  borderRadius:
                    "16px",
                  background:
                    "#faf8ff",
                  border:
                    "1px solid #e8e1f5",
                  textAlign:
                    "center",
                }}
              >

                <div
                  style={{
                    fontSize:
                      "34px",
                    marginBottom:
                      "10px",
                  }}
                >
                  🚏
                </div>

                <strong>
                  {transportData
                    ? `No nearby ${
                        selectedType === "bus"
                          ? "bus stops"
                          : selectedType === "train"
                          ? "railway stations"
                          : "metro stations"
                      } found.`
                    : "Transport data hasn't loaded yet."}
                </strong>

                <p
                  style={{
                    margin:
                      "8px 0 0",
                    color:
                      "#77717d",
                  }}
                >
                  {transportData
                    ? "Try another transport option."
                    : "Use \"Try again\" above to reload it."}
                </p>

              </div>
            )}

            {/* RESULTS */}

            {selectedResults.map(
              (
                item,
                index
              ) => (
                <div
                  key={`${item?.name || "transport"}-${index}`}
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap:
                      "16px",
                    padding:
                      "18px",
                    marginBottom:
                      "12px",
                    background:
                      "white",
                    border:
                      "1px solid #e8e1f5",
                    borderRadius:
                      "16px",
                    boxShadow:
                      "0 4px 14px rgba(70, 45, 110, 0.06)",
                  }}
                >

                  {/* ICON */}

                  <div
                    style={{
                      width:
                        "48px",
                      height:
                        "48px",
                      minWidth:
                        "48px",
                      borderRadius:
                        "14px",
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      background:
                        "#f1ebff",
                      fontSize:
                        "24px",
                    }}
                  >

                    {selectedType ===
                    "bus"
                      ? "🚌"
                      : selectedType ===
                        "train"
                      ? "🚆"
                      : "🚇"}

                  </div>

                  {/* INFORMATION */}

                  <div
                    style={{
                      flex: 1,
                    }}
                  >

                    <strong
                      style={{
                        display:
                          "block",
                        fontSize:
                          "16px",
                        color:
                          "#24212a",
                        marginBottom:
                          "5px",
                      }}
                    >
                      {item?.name ||
                        "Unnamed location"}
                    </strong>

                    {item?.distanceFromCenter !==
                      undefined && (
                      <span
                        style={{
                          display:
                            "block",
                          color:
                            "#77717d",
                          fontSize:
                            "13px",
                        }}
                      >
                        📍{" "}
                        {
                          item.distanceFromCenter
                        }{" "}
                        km from midpoint
                      </span>
                    )}

                    {item?.route && (
                      <span
                        style={{
                          display:
                            "block",
                          marginTop:
                            "5px",
                          color:
                            "#5d43a6",
                          fontSize:
                            "12px",
                          fontWeight:
                            "600",
                        }}
                      >
                        Route:{" "}
                        {item.route}
                      </span>
                    )}

                    {item?.line && (
                      <span
                        style={{
                          display:
                            "block",
                          marginTop:
                            "4px",
                          color:
                            "#5d43a6",
                          fontSize:
                            "12px",
                        }}
                      >
                        Line:{" "}
                        {item.line}
                      </span>
                    )}

                    {item?.operator && (
                      <span
                        style={{
                          display:
                            "block",
                          marginTop:
                            "4px",
                          color:
                            "#77717d",
                          fontSize:
                            "12px",
                        }}
                      >
                        Operator:{" "}
                        {item.operator}
                      </span>
                    )}

                  </div>

                  {/* DISTANCE */}

                  {item?.distanceFromCenter !==
                    undefined && (
                    <div
                      style={{
                        textAlign:
                          "right",
                      }}
                    >

                      <span
                        style={{
                          display:
                            "block",
                          fontSize:
                            "11px",
                          color:
                            "#9992a3",
                          marginBottom:
                            "3px",
                        }}
                      >
                        DISTANCE
                      </span>

                      <strong
                        style={{
                          color:
                            "#5d43a6",
                          fontSize:
                            "14px",
                        }}
                      >
                        {
                          item.distanceFromCenter
                        }{" "}
                        km
                      </strong>

                    </div>
                  )}

                </div>
              )
            )}

          </div>
        )}

        {/* INFORMATION */}

        <div className="pt-info-card">

          <div className="pt-info-icon">
            💡
          </div>

          <div>

            <strong>
              Smart travel planning
            </strong>

            <p>
              MoodMate uses OpenStreetMap
              data through OpenLayers to
              display your group's locations
              and calculated midpoint. Public
              transport information is loaded
              from your existing travel service.
            </p>

          </div>

        </div>

        <button
          className="pt-continue-btn"
          type="button"
          onClick={() => {
            const nextPlan = {
              ...plan,
              startLocation,
              midpoint: {
                lat: midpointLat,
                lng: midpointLng,
                name: midpointName,
              },
              mood,
              memberCount,
              locationMode,
              travelMode,
              currentLocation,
              budget,
              vibes,
              members: validMembers.length ? validMembers : members,
            };

            updatePlan(nextPlan);
            navigate("/recommendations", {
              state: nextPlan,
            });
          }}
        >
          Continue to recommendations →
        </button>

      </div>
    </div>
  );
}