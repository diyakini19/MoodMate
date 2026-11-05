import React, { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMergedPlan, usePlan } from "../context/PlanContext";
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

import Style from "ol/style/Style";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Text from "ol/style/Text";

import { fromLonLat } from "ol/proj";
import { boundingExtent } from "ol/extent";

import "./PrivateTransport.css";

export default function PrivateTransport() {
  const navigate = useNavigate();
  const { updatePlan } = usePlan();
  const data = useMergedPlan();

  const mapElementRef = useRef(null);
  const mapRef = useRef(null);

  const startLocation = data.startLocation || "";
  const midpoint = data.midpoint || {};
  const members = Array.isArray(data.members)
    ? data.members
    : [];

  /*
   * =========================================================
   * MIDPOINT
   * =========================================================
   */

  const midpointLat = Number(midpoint?.lat);
  const midpointLng = Number(midpoint?.lng);

  const hasMidpoint =
    Number.isFinite(midpointLat) &&
    Number.isFinite(midpointLng);

  /*
   * =========================================================
   * VALID MEMBERS
   * =========================================================
   */

  const validMembers = useMemo(() => {
    return members.filter((member) => {
      const lat = Number(member?.lat);
      const lng = Number(member?.lng);

      return (
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      );
    });
  }, [members]);

  /*
   * =========================================================
   * MAP LOCATIONS
   * =========================================================
   */

  const mapLocations = useMemo(() => {
    const locations = [];

    validMembers.forEach((member) => {
      locations.push([
        Number(member.lat),
        Number(member.lng),
      ]);
    });

    if (hasMidpoint) {
      locations.push([
        midpointLat,
        midpointLng,
      ]);
    }

    return locations;
  }, [
    validMembers,
    hasMidpoint,
    midpointLat,
    midpointLng,
  ]);

  /*
   * =========================================================
   * MAP
   * =========================================================
   */

  useEffect(() => {
    if (!mapElementRef.current) {
      return;
    }

    if (
      !hasMidpoint &&
      validMembers.length === 0
    ) {
      return;
    }

    /*
     * Remove previous map
     */

    if (mapRef.current) {
      mapRef.current.setTarget(null);
      mapRef.current = null;
    }

    /*
     * =======================================================
     * VECTOR SOURCE
     * =======================================================
     */

    const vectorSource =
      new VectorSource();

    /*
     * =======================================================
     * MEMBER MARKERS
     * =======================================================
     */

    validMembers.forEach(
      (member, index) => {
        const lat = Number(member.lat);
        const lng = Number(member.lng);

        const feature =
          new Feature({
            geometry: new Point(
              fromLonLat([
                lng,
                lat,
              ])
            ),
            name:
              member.name ||
              `Member ${index + 1}`,
          });

        feature.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 18,
              fill: new Fill({
                color: "#8b5cf6",
              }),
              stroke: new Stroke({
                color: "#ffffff",
                width: 3,
              }),
            }),

            text: new Text({
              text: String(index + 1),
              fill: new Fill({
                color: "#ffffff",
              }),
              font:
                "bold 14px Arial",
            }),
          })
        );

        vectorSource.addFeature(
          feature
        );
      }
    );

    /*
     * =======================================================
     * MIDPOINT MARKER
     * =======================================================
     */

    if (hasMidpoint) {
      const midpointFeature =
        new Feature({
          geometry: new Point(
            fromLonLat([
              midpointLng,
              midpointLat,
            ])
          ),
        });

      midpointFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 22,
            fill: new Fill({
              color: "#f59e0b",
            }),
            stroke: new Stroke({
              color: "#ffffff",
              width: 4,
            }),
          }),

          text: new Text({
            text: "★",
            fill: new Fill({
              color: "#ffffff",
            }),
            font:
              "bold 20px Arial",
          }),
        })
      );

      vectorSource.addFeature(
        midpointFeature
      );
    }

    /*
     * =======================================================
     * MEMBER → MIDPOINT LINES
     * =======================================================
     */

    if (hasMidpoint) {
      validMembers.forEach(
        (member) => {
          const memberLat =
            Number(member.lat);

          const memberLng =
            Number(member.lng);

          const lineFeature =
            new Feature({
              geometry:
                new LineString([
                  fromLonLat([
                    memberLng,
                    memberLat,
                  ]),

                  fromLonLat([
                    midpointLng,
                    midpointLat,
                  ]),
                ]),
            });

          lineFeature.setStyle(
            new Style({
              stroke: new Stroke({
                color: "#9b6cff",
                width: 3,
                lineDash: [
                  8,
                  8,
                ],
              }),
            })
          );

          vectorSource.addFeature(
            lineFeature
          );
        }
      );
    }

    /*
     * =======================================================
     * VECTOR LAYER
     * =======================================================
     */

    const vectorLayer =
      new VectorLayer({
        source: vectorSource,
      });

    /*
     * =======================================================
     * OPENSTREETMAP TILE LAYER
     * =======================================================
     */

    const osmLayer =
      new TileLayer({
        source: new OSM(),
      });

    /*
     * =======================================================
     * OPENLAYERS MAP
     * =======================================================
     */

    const map =
      new Map({
        target:
          mapElementRef.current,

        layers: [
          osmLayer,
          vectorLayer,
        ],

        view: new View({
          center: fromLonLat([
            hasMidpoint
              ? midpointLng
              : Number(
                  validMembers[0]?.lng
                ) || 73.029,

            hasMidpoint
              ? midpointLat
              : Number(
                  validMembers[0]?.lat
                ) || 19.033,
          ]),

          zoom: 13,

          minZoom: 3,

          maxZoom: 19,
        }),
      });

    mapRef.current = map;

    /*
     * =======================================================
     * FIT ALL MARKERS
     * =======================================================
     */

    if (mapLocations.length > 0) {
      const coordinates =
        mapLocations.map(
          ([lat, lng]) =>
            fromLonLat([
              lng,
              lat,
            ])
        );

      if (coordinates.length === 1) {
        map.getView().setCenter(
          coordinates[0]
        );

        map.getView().setZoom(14);
      } else {
        const extent =
          boundingExtent(
            coordinates
          );

        map.getView().fit(
          extent,
          {
            padding: [
              60,
              60,
              60,
              60,
            ],

            maxZoom: 14,

            duration: 500,
          }
        );
      }
    }

    /*
     * =======================================================
     * FORCE MAP SIZE UPDATE
     * =======================================================
     */

    setTimeout(() => {
      map.updateSize();
    }, 100);

    setTimeout(() => {
      map.updateSize();
    }, 500);

    setTimeout(() => {
      map.updateSize();
    }, 1000);

    /*
     * =======================================================
     * CLEANUP
     * =======================================================
     */

    return () => {
      map.setTarget(null);

      mapRef.current = null;
    };
  }, [
    hasMidpoint,
    midpointLat,
    midpointLng,
    validMembers,
    mapLocations,
  ]);

  /*
   * =========================================================
   * NO LOCATION
   * =========================================================
   */

  if (
    !hasMidpoint &&
    validMembers.length === 0
  ) {
    return (
      <div className="private-transport-page app-page">
        <AppHeader
          onBack={() => navigate("/midpoint", { state: data })}
        />

        <div className="private-transport-container app-page-main">

          <div className="private-error-card">

            <div className="private-error-icon">
              📍
            </div>

            <h2>
              Location information is missing
            </h2>

            <p>
              We couldn't find valid
              coordinates for your group.
              Please go back and calculate
              the midpoint again.
            </p>

            <button
              className="private-primary-btn"
              onClick={() =>
                navigate("/midpoint", { state: data })
              }
            >
              ← Back to Midpoint
            </button>

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
    <div className="private-transport-page app-page">
      <AppHeader
        onBack={() => navigate("/midpoint", { state: data })}
      />

      <div className="private-transport-container app-page-main">

        {/* HEADER */}

        <div className="private-header">

          <span className="private-label">
            PRIVATE TRANSPORT
          </span>

          <h1>
            Your route,
            <br />
            your way.
          </h1>

          <p>
            Use the group's midpoint as
            your meeting point and plan
            your private journey from there.
          </p>

        </div>

        {/* ROUTE SUMMARY */}

        <div className="private-route-summary">

          <div className="private-location-block">

            <div className="private-location-icon">
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

          <div className="private-route-arrow">
            →
          </div>

          <div className="private-location-block">

            <div className="private-location-icon destination">
              ★
            </div>

            <div>
              <span>
                GROUP MIDPOINT
              </span>

              <strong>
                {midpoint?.name ||
                  "Smart midpoint"}
              </strong>
            </div>

          </div>

        </div>

        {/* MAP */}

        <section className="private-map-section">

          <div className="private-section-heading">

            <div>
              <span>
                GROUP LOCATION
              </span>

              <h2>
                Your group's midpoint
              </h2>
            </div>

            <div className="private-map-badge">
              OpenStreetMap
            </div>

          </div>

          <div className="private-map-wrapper">

            <div
              ref={mapElementRef}
              className="private-openlayers-map"
            />

          </div>

          {/* LEGEND */}

          <div className="private-map-legend">

            <div>
              <span className="legend-dot member">
                1
              </span>
              Group member
            </div>

            <div>
              <span className="legend-dot midpoint">
                ★
              </span>
              Group midpoint
            </div>

          </div>

        </section>

        {/* PRIVATE TRANSPORT */}

        <section className="private-options-section">

          <h2>
            Private transport
          </h2>

          <p>
            Choose how you plan to travel
            to the group's midpoint.
          </p>

          <div className="private-mode-grid">

            <button
              type="button"
              className="private-mode-card selected"
            >
              <span className="private-mode-icon">
                🚗
              </span>

              <strong>
                Car
              </strong>

              <small>
                Drive to the midpoint
              </small>
            </button>

            <button
              type="button"
              className="private-mode-card"
            >
              <span className="private-mode-icon">
                🚕
              </span>

              <strong>
                Cab
              </strong>

              <small>
                Book a cab to the midpoint
              </small>
            </button>

            <button
              type="button"
              className="private-mode-card"
            >
              <span className="private-mode-icon">
                🏍️
              </span>

              <strong>
                Bike
              </strong>

              <small>
                Ride to the midpoint
              </small>
            </button>

          </div>

        </section>

        {/* MEETING POINT */}

        <section className="private-destination-section">

          <h2>
            Meeting point
          </h2>

          <p>
            This is the calculated location
            where your group can meet.
          </p>

          <div
            className="private-route-summary"
            style={{
              marginBottom: 0,
              marginTop: "20px",
            }}
          >

            <div className="private-location-block">

              <div className="private-location-icon destination">
                ★
              </div>

              <div>

                <span>
                  MIDPOINT
                </span>

                <strong>
                  {midpoint?.name ||
                    "Smart midpoint"}
                </strong>

              </div>

            </div>

            <div
              style={{
                color: "#74817b",
                fontSize: "12px",
              }}
            >
              {hasMidpoint
                ? `${midpointLat.toFixed(
                    5
                  )}, ${midpointLng.toFixed(
                    5
                  )}`
                : "Coordinates unavailable"}
            </div>

          </div>

        </section>

        {/* INFO */}

        <div className="private-info-card">

          <div className="private-info-icon">
            💡
          </div>

          <div>

            <strong>
              Smart travel planning
            </strong>

            <p>
              MoodMate uses your group's
              calculated midpoint as the
              meeting point. The map uses
              OpenStreetMap data through
              OpenLayers.
            </p>

          </div>

        </div>

        <div className="private-actions">
          {hasMidpoint && startLocation && (
            <button
              type="button"
              className="private-secondary-btn"
              onClick={() => {
                const origin = encodeURIComponent(startLocation);
                const destination = encodeURIComponent(
                  `${midpointLat},${midpointLng}`
                );

                window.open(
                  `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`,
                  "_blank",
                  "noopener,noreferrer"
                );
              }}
            >
              Open driving directions
            </button>
          )}

          <button
            type="button"
            className="private-primary-btn"
            onClick={() => {
              const nextPlan = {
                ...data,
                startLocation,
                midpoint: {
                  ...midpoint,
                  lat: midpointLat,
                  lng: midpointLng,
                  name: midpoint?.name || "Smart midpoint",
                },
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

    </div>
  );
}