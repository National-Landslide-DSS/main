import AppBase from "./support/AppBase.js";
import AppLoader from "./loaders/AppLoader.js";
import SignIn from "./apl/SignIn.js";
import ViewLoading from "./apl/ViewLoading.js";
import MapScale from './apl/MapScale.js';
import { createBarChart } from "./apl/CreateChart.js";
import { uploadData } from "./apl/UploadData.js";

class Application extends AppBase {
  // PORTAL //
  portal;

  constructor() {
    super();

    // LOAD APPLICATION BASE //
    super.load().then(() => {
      // APPLICATION LOADER //
      const applicationLoader = new AppLoader({ app: this });
      applicationLoader.load().then(({ portal, group, map, view }) => {
        // PORTAL //
        this.portal = portal;

        // SET APPLICATION DETAILS //
        this.setApplicationDetails({map, group});

        // VIEW SHAREABLE URL PARAMETERS //
        this.initializeViewShareable({view});

        // USER SIGN-IN //
        this.configUserSignIn();

        // APPLICATION //
        this.applicationReady({portal, group, map, view}).catch(this.displayError).then(() => {
          // HIDE APP LOADER //
          document.getElementById('app-loader').toggleAttribute('hidden', true);
        });
      }).catch(this.displayError);
    }).catch(this.displayError);
  }


  /**
   * Initialize panel state management
   */
  initializePanelState() {
    const leftPanel = document.querySelector('calcite-shell-panel[slot="panel-start"]');
    const rightStatsPanel = document.getElementById('panel-stats-end');

    // Load saved states from localStorage
    const leftPanelCollapsed = localStorage.getItem('leftPanelCollapsed') === 'true';
    const rightStatsCollapsed = localStorage.getItem('rightStatsCollapsed') !== 'false';

    leftPanel.collapsed = leftPanelCollapsed;
    rightStatsPanel.collapsed = rightStatsCollapsed;

    // Save states when changed
    leftPanel.addEventListener('calciteShellPanelToggle', () => {
      localStorage.setItem('leftPanelCollapsed', leftPanel.collapsed);
    });

    rightStatsPanel.addEventListener('calciteShellPanelToggle', () => {
      localStorage.setItem('rightStatsCollapsed', rightStatsPanel.collapsed);
    });
  }

  /**
   * Configure user sign-in
   */
  configUserSignIn() {
    const signInContainer = document.getElementById("sign-in-container");
    if (signInContainer) {
      const signIn = new SignIn({container: signInContainer, portal: this.portal});
    }
  }

  /**
   * Configure the map view
   */
  configView({view}) {
    return new Promise((resolve, reject) => {
      if (view) {
        require([
          'esri/core/reactiveUtils',
          'esri/widgets/Popup',
          'esri/widgets/Home',
          'esri/widgets/Search',
          'esri/widgets/Compass',
          'esri/widgets/LayerList',
          'esri/widgets/Slider',
          'esri/widgets/Legend',
          'esri/widgets/BasemapGallery',
          'esri/widgets/Expand',
          'esri/widgets/Measurement',
        ], (reactiveUtils, Popup, Home, Search, Compass, LayerList, Slider, Legend, BasemapGallery, Expand, Measurement) => {
          // VIEW AND POPUP //
          view.set({
            constraints: { snapToZoom: false },
            highlightOptions: {
              fillOpacity: 0,
            },
            popup: new Popup({
              dockEnabled: true,
              dockOptions: {
                buttonEnabled: false,
                breakpoint: false,
                position: "top-right",
              },
            }),          
          });

          // SEARCH //
          const search = new Search({
            view: view,
            locationEnabled: false,
            resultGraphicEnabled: false,
            popupEnabled: false,
          });

          const searchExpand = new Expand({
            expandTooltip: "Search",
            view: view,
            content: search
          });
          view.ui.add(searchExpand, { position: "top-left", index: 0 });

          // HOME //
          const home = new Home({ view });
          view.ui.add(home, { position: "top-left", index: 1 });

          // COMPASS //
          const compass = new Compass({view: view});
          view.ui.add(compass, {position: 'top-left', index: 2});
          reactiveUtils.watch(() => view.rotation, rotation => {
            compass.set({visible: (rotation > 0)});
          }, {initial: true});

          // MEASUREMENT TOOL //
          const measurement = new Measurement({
            view: view,
            container: document.createElement("div"),
            linearUnit: "kilometers",
            areaUnit: "square-kilometers"
          });

          view.ui.add(measurement, "bottom-right");

          // Toolbar setup
          const toolbarDiv = document.createElement("div");
          toolbarDiv.id = "toolbarDiv";
          toolbarDiv.className = "esri-component esri-widget";
          toolbarDiv.innerHTML = `
            <button id="distance" class="esri-widget--button esri-interactive esri-icon-measure-line" title="Distance Measurement Tool"></button>
            <button id="area" class="esri-widget--button esri-interactive esri-icon-measure-area" title="Area Measurement Tool"></button>
            <button id="clear" class="esri-widget--button esri-interactive esri-icon-trash" title="Clear Measurements"></button>
          `;
          view.ui.add(toolbarDiv, "top-right");

          // Event listeners
          document.getElementById("distance").addEventListener("click", () => {
            measurement.activeTool = "distance";
            toggleActiveButton("distance");
          });

          document.getElementById("area").addEventListener("click", () => {
            measurement.activeTool = "area";
            toggleActiveButton("area");
          });

          document.getElementById("clear").addEventListener("click", () => {
            measurement.clear();
            document.querySelectorAll("#toolbarDiv button").forEach(btn => {
              btn.classList.remove("active");
            });
          });

          function toggleActiveButton(activeId) {
            document.querySelectorAll("#toolbarDiv button").forEach(btn => {
              btn.classList.toggle("active", btn.id === activeId);
            });
          }
          // MAP SCALE //
          const mapScale = new MapScale({view});
          view.ui.add(mapScale, {position: 'bottom-right', index: 0});

          // LAYER LIST //
          const layerList = new LayerList({
            container: "layer-list-container",
            view: view,
            visibleElements: { statusIndicators: true },
            listItemCreatedFunction: (evt) => {
              const item = evt.item;
              const layer = item.layer;

              // Hide all non-INDEX_INFO layers (except basemaps) by default
              if (layer.title !== "INDEX_INFO" && layer.type !== "basemap") {
                item.visible = false;    // Hide in LayerList UI
                layer.visible = false;  // Hide on the map
              }

              // Add opacity slider to EVERY layer (including hidden ones)
              item.actionsSections = [{
                title: "Opacity",
                className: "esri-icon-up",
                id: "increase-opacity"
              }];

              const slider = new Slider({
                min: 0,
                max: 100,
                values: [layer.opacity * 100], // Current opacity
                steps: [0, 25, 50, 75, 100],
                snapOnClickEnabled: true,
                tickConfigs: [{ 
                  mode: "position", 
                  values: [0, 25, 50, 75, 100],
                  labelsVisible: false 
                }],
                visibleElements: { 
                  labels: false, 
                  rangeLabels: true 
                }
              });

              item.panel = {
                content: slider,
                className: "esri-icon-sliders-horizontal",
                title: "Change layer opacity",
                open: false
              };

              // Update layer opacity when slider changes
              slider.on("thumb-drag", (evt) => {
                layer.opacity = evt.value / 100;
              });

              // Format percentage display
              slider.labelFormatFunction = (value, type) => 
                type === "value" ? value : `${value}%`;
            }
          });

          // LEGEND //
          const legendPanel = new Legend({
            container: "legend-container",
            view: view,
            layerInfos: view.map.allLayers
              .filter((layer) => layer.title !== "INDEX_INFO") // Exclude risk layers
              .map((layer) => ({ layer })), // Map remaining layers to layerInfos
          });

          // LEGEND ON MAP //
          // LEGEND ON MAP //
          const riskLayer = view.map.allLayers.find((layer) => layer.title === 'INDEX_INFO');
          const legend = new Legend({
            view: view,
            layerInfos: [
              {
                layer: riskLayer
              }
            ]
          });

          // Check if the legendExpand widget already exists
          let legendExpand = view.ui.find("legendExpand");
          if (!legendExpand) {
            legendExpand = new Expand({
              id: "legendExpand",
              expandTooltip: "Legend",
              view: view,
              content: legend,
              expanded: true
            });

            // Sync expanded state (add the watcher only once)
            legendExpand.watch("expanded", (isExpanded) => {
              console.log(`Legend is now ${isExpanded ? "expanded" : "collapsed"}`);
            });

            view.ui.add(legendExpand, { position: "bottom-left", index: 0 });
          }

          // BASEMAP GALLERY //
          const basemapGallery = new BasemapGallery({
            view: view,
            container: 'basemap-gallery-container', // Ensure this matches your container ID
            source: {
              query: {
                 // Adjust query as needed
              }
            }
          });

          // VIEW LOADING INDICATOR //
          const viewLoading = new ViewLoading({ view: view });
          view.ui.add(viewLoading, "bottom-right");

          resolve();
        });
      } else { resolve(); }
    });
  }

  /**
   * Initialize upload data functionality
   */
  initializeUploadData({ portal, map, view }) {
    const uploadForm = document.getElementById('uploadForm');
    const inFile = document.getElementById('inFile');
    const uploadBtn = document.getElementById('upload-btn');
    const removeBtn = document.getElementById('remove-btn');
    const uploadLoader = document.getElementById('upload-loader');
    const appAddData = document.getElementById('app-add-data');

    // Store uploaded layers
    let uploadedLayers = [];

    // Enable/disable upload button based on file selection
    inFile.addEventListener('change', (event) => {
      uploadBtn.disabled = !event.target.files.length;
    });

    // Upload button click handler
    uploadBtn.addEventListener('click', async () => {
      const file = inFile.files[0];
      if (!file) return;

      try {
        // Show loading state
        uploadLoader.hidden = false;
        uploadBtn.disabled = true;
        removeBtn.disabled = true;

        // Process the file
        const result = await uploadData(portal, map, view, file);

        // Store the uploaded layers
        uploadedLayers = result.layers;

        // Show success message
        appAddData.slot = 'title';
        appAddData.slot = 'message';
        appAddData.icon = 'upload';
        appAddData.kind = 'success';
        appAddData.message = 'Data uploaded successfully!';
        appAddData.autoClose = true;
        appAddData.open = true;

        // Reset form
        uploadForm.reset();
        uploadBtn.disabled = true;
        removeBtn.disabled = false;
      } catch (error) {
        appAddData.kind = 'danger';
        appAddData.message = `Upload failed: ${error.message}`;
        appAddData.open = true;
      } finally {
        uploadLoader.hidden = true;
        uploadBtn.disabled = false;
        removeBtn.disabled = false;
      }
    });

    // Remove button click handler
    removeBtn.addEventListener('click', () => {
      try {
        if (uploadedLayers.length > 0) {
          // Show loading state
          uploadLoader.hidden = false;
          removeBtn.disabled = true;
          
          // Remove all uploaded layers
          map.removeMany(uploadedLayers);
          uploadedLayers = [];
          
          // Show success message
          appAddData.kind = 'success';
          appAddData.message = 'Uploaded data removed successfully!';
          appAddData.autoClose = true;
          appAddData.open = true;
          
          // Reset form
          uploadForm.reset();
          uploadBtn.disabled = true;
        } else {
          appAddData.kind = 'warning';
          appAddData.message = 'No uploaded data to remove';
          appAddData.open = true;
        }
      } catch (error) {
        appAddData.kind = 'danger';
        appAddData.message = `Failed to remove data: ${error.message}`;
        appAddData.open = true;
      } finally {
        uploadLoader.hidden = true;
        removeBtn.disabled = false;
      }
    });
  }

  /**
   * Initialize charts (only bar chart)
   */
  initializeCharts() {
    // DIMENSIONS BAR CHART //
    const dimensionsChartNode = document.getElementById("dimensions-bar-chart");
    this.barChart = createBarChart(dimensionsChartNode);

    /**
     * Clear chart data
     */
    this.clearCharts = () => {
      this.barChart.clearData();
    };

    /**
     * Update chart with feature data
     */
    this.updateCharts = (feature) => {
      if (!feature) {
        this.clearCharts();
        return;
      }

      //Get Values 
      const hazardValue = feature.getAttribute("hazard") || 0;
      const vulnerabilityValue = feature.getAttribute("vulnerabil") || 0;
      const exposureValue = feature.getAttribute("exposure") || 0;

      //Update charts
      this.barChart.updateData([hazardValue, vulnerabilityValue,exposureValue ]);
    };
  }

  /**
   * Initialize display details functionality
   */
  initializeDisplayDetails({view}) {
    if (view) {
      require([
        "esri/core/reactiveUtils"
      ], (reactiveUtils) => {
        // DEFAULT EXTENT //
        const defaultView = view.center;
        const defaultZoom = view.zoom;

        const numberFormatter = new Intl.NumberFormat('en-US');

        // FEATURE LAYER //
        const layerTitle = "INDEX_INFO";
        const featureLayer = view.map.allLayers.find((layer) => layer.title === layerTitle);

        const adminNameNode = document.getElementById('admin-name');
        const adminTitleNode = adminNameNode.querySelector('[slot="title"]');
        const adminMessageNode = adminNameNode.querySelector('[slot="message"]');
        const adminDescriptiveNode = document.getElementById('admin-descriptive');
        const populationLabel = document.getElementById('total-population-label');
        const maleLabel = document.getElementById('male-population-label');
        const femaleLabel = document.getElementById('female-population-label');
        const householdLabel = document.getElementById('total-household-label');
        const key1Label = document.getElementById('key1-label');
        const key2Label = document.getElementById('key2-label');
        const key3Label = document.getElementById('key3-label');
        const key4Label = document.getElementById('key4-label');
        const roadsRiskLabel = document.getElementById('risk-road-label');
        const bridgesRiskLabel = document.getElementById('risk-bridge-label');
        const schoolsRiskLabel = document.getElementById('risk-school-label');
        const healthRiskLabel = document.getElementById('risk-health-label');
        const forestRiskLabel = document.getElementById('risk-forest-label');
        const alpineShrubsLabel = document.getElementById('risk-alpine-label');
        const shrubsLabel = document.getElementById('risk-shrub-label');
        const meadowsLabel = document.getElementById('risk-meadow-label');
        const agricultureLabel = document.getElementById('risk-agri-label');
        const buildupLabel = document.getElementById('risk-builtup-label');
        const nonBuildupLabel = document.getElementById('risk-nonbuiltup-label');
        const otherLabel = document.getElementById('risk-other-label');

        const createReportBtn = document.getElementById("create-report-btn");

        /**
         * Clear details display
         */
        this.clearDetails = (view, layerView) => {
          if (layerView) {
            // CLEAR EFFECTS //
            layerView.featureEffect = null;
          } else {
            console.warn("layerView is null or undefined. Cannot clear featureEffect.");
          }

          if (view) {
            // ZOOM TO DEFAULT EXTENT //
            view.goTo(
              {
                center: defaultView,
                zoom: defaultZoom,
              },
              {
                animate: true,
                duration: 1000,
              }
            );
          } else {
            console.warn("view is null or undefined. Cannot reset map view.");
          }

          // CLEAR CONTENT OF DOM ELEMENTS (WITH NULL CHECKS)
          const setInnerHTML = (element, value) => {
            if (element) {
              element.innerHTML = value;
            } else {
              console.warn("Element is null or undefined. Skipping innerHTML update.");
            }
          };

          setInnerHTML(adminTitleNode, "Click on the map to get information");
          setInnerHTML(adminMessageNode, "");
          setInnerHTML(adminDescriptiveNode, "");
          setInnerHTML(populationLabel, "-.-");
          setInnerHTML(maleLabel, "-.-");
          setInnerHTML(femaleLabel, "-.-");
          setInnerHTML(householdLabel, "-.-");
          setInnerHTML(key1Label, "-.-");
          setInnerHTML(key2Label, "-.-");
          setInnerHTML(key3Label, "-.-");
          setInnerHTML(key4Label, "-.-");
          setInnerHTML(roadsRiskLabel, "-.-");
          setInnerHTML(bridgesRiskLabel, "-.-");
          setInnerHTML(schoolsRiskLabel, "-.-");
          setInnerHTML(healthRiskLabel, "-.-");
          setInnerHTML(forestRiskLabel, "-.-");
          setInnerHTML(alpineShrubsLabel, "-.-");
          setInnerHTML(shrubsLabel, "-.-");
          setInnerHTML(meadowsLabel, "-.-");
          setInnerHTML(agricultureLabel, "-.-");
          setInnerHTML(buildupLabel, "-.-");
          setInnerHTML(nonBuildupLabel, "-.-");
          setInnerHTML(otherLabel, "-.-");

          if (createReportBtn) {
            createReportBtn.setAttribute("href", "");
          } else {
            console.warn("createReportBtn is null or undefined. Skipping href update.");
          }
        };

        /**
         * Update details with feature data
         */
        this.updateDetails = (feature, layerView) => {
          // APPLY EFFECTS TO SELECTED FEATURE //
          layerView.featureEffect = {
            filter: {
              where: `id_2 = ${feature.getAttribute("id_2")}`
            },
            excludedLabelsVisible: true,
          };

          // ZOOM TO SELECTED ADMIN //
          view.goTo({
              center: feature.geometry.extent,
              center: feature.geometry.centroid,
              zoom: 10
            },{
              animate: true,
              duration: 1000
            }
          );

          //Get the risk score 
          const riskScore = feature.getAttribute("risk")

          //Classify the risk into 5 categories
          let riskClass;
          if (riskScore <= 0.2) riskClass = "Very Low";
          else if (riskScore <= 0.4) riskClass = "Low";
          else if (riskScore <= 0.6) riskClass = "Moderate";
          else if (riskScore <= 0.8) riskClass = "High";
          else riskClass = "Very High";

          //Convert risk score to scale
          const riskScoureOutof10 = (riskScore*10).toFixed(1);

          // UPDATE RISK SCORE AND ADMIN NAME//
          adminTitleNode.innerHTML = `Risk Index is <b>${riskClass}</b> (Score: <b>${riskScoureOutof10}</b> out of 10)`
          let adminName = [];
          adminName.push(feature.getAttribute("name_2"));
          adminName.push(feature.getAttribute("name_1"));
          adminMessageNode.innerHTML = adminName.join(", ");

          // UPDATE KEY INDICATORS //
          // Ensure the element exists
          const adminDescriptiveNode = document.getElementById('admin-descriptive');
          if (adminDescriptiveNode) {
            // Apply inline styles for line spacing
            adminDescriptiveNode.style.lineHeight = "1.8"; // Adjust line spacing
            adminDescriptiveNode.style.marginBottom = "10px"; // Optional: Add spacing below the text

            // Update the content
            adminDescriptiveNode.innerHTML = `
              The risk index rating is <b>${riskClass} (Score: ${riskScoureOutof10} out of 10)</b> 
              for <b>${adminName.slice(0, 3).join(", ")}</b> when compared to the rest of the gewogs in 
              ${feature.getAttribute("name_1")}.
            `;
          } else {
            console.error("Element with ID 'admin-descriptive' not found.");
          }
          populationLabel.innerHTML = numberFormatter.format(feature.getAttribute("total_popu"));
          maleLabel.innerHTML = numberFormatter.format(feature.getAttribute("male"));
          femaleLabel.innerHTML = numberFormatter.format(feature.getAttribute("female"));
          householdLabel.innerHTML = numberFormatter.format(feature.getAttribute("total_hh"));
          key1Label.innerHTML = numberFormatter.format(feature.getAttribute("age__5"));
          key2Label.innerHTML = numberFormatter.format(feature.getAttribute("age__65"));
          key3Label.innerHTML = numberFormatter.format(feature.getAttribute("hh_woe"));
          key4Label.innerHTML = numberFormatter.format(feature.getAttribute("hh_won"));
          roadsRiskLabel.innerHTML = numberFormatter.format(feature.getAttribute("road_lengt"));
          bridgesRiskLabel.innerHTML = numberFormatter.format(feature.getAttribute("no_bridges"));
          schoolsRiskLabel.innerHTML = numberFormatter.format(feature.getAttribute("no_edu"));
          healthRiskLabel.innerHTML = numberFormatter.format(feature.getAttribute("no_hlth"));
          forestRiskLabel.innerHTML = numberFormatter.format(feature.getAttribute("forest"));
          alpineShrubsLabel.innerHTML = numberFormatter.format(feature.getAttribute("alpine_shr"));
          shrubsLabel.innerHTML = numberFormatter.format(feature.getAttribute("shrubs"));
          meadowsLabel.innerHTML = numberFormatter.format(feature.getAttribute("meadows"));
          agricultureLabel.innerHTML = numberFormatter.format(feature.getAttribute("agricultur"));
          buildupLabel.innerHTML = numberFormatter.format(feature.getAttribute("buildup"));
          nonBuildupLabel.innerHTML = numberFormatter.format(feature.getAttribute("non_buildu"));
          otherLabel.innerHTML = numberFormatter.format(feature.getAttribute("others"));
          
          // UPDATE REPORT LINK //
          createReportBtn.setAttribute('href', `./report/index.html?id=${feature.getAttribute("name_2")}`);
        };
      });
    }
  }

  /**
   * Initialize map display functionality
   */
  initializeMapDisplay({ view }) {
    if (view) {
      require([
        "esri/core/reactiveUtils",
        "esri/smartMapping/renderers/color",
      ], (reactiveUtils, colorRendererCreator) => {
        // FEATURE LAYER //
        const layerTitle = "INDEX_INFO";
        const featureLayer = view.map.allLayers.find((layer) => layer.title === layerTitle);
  
        // Disable popups for all layers
        view.map.allLayers.forEach((layer) => {
          layer.popupEnabled = false; // Disable default popups
        });
  
        if (featureLayer) {
          featureLayer.opacity = 1;
          featureLayer.popupEnabled = false; // Enable popups for the desired layer
  
  
          view.whenLayerView(featureLayer).then((layerView) => {
            reactiveUtils
              .whenOnce(() => !layerView.updating)
              .then(() => {
                generateRenderer();
              });
          });
  
          // SET COLOR THEME //
          const riskColor = ["#FFFDFB", "#F5C5AB", "#E19884", "#DB6857", "#C93636"];
          const hzColor = ["#FFFDFB", "#FFF1E2", "#FEDCBA", "#FCB16C", "#F78721"];
          const vuColor = ["#FCFBFD", "#EDE8F4", "#CFC4E0", "#A68FC5", "#75559B"];
          const ccColor = ["#F0F8FF", "#C2E0FF", "#7EB8FF", "#3A8CFF", "#0062CC"];
  
          const generateRenderer = (thematicField) => {
            let fieldSelect = thematicField || "risk";
  
            const params = {
              layer: featureLayer,
              view: view,
              field: fieldSelect,
              classificationMethod: "equal-interval",
              numClasses: 5,
              defaultSymbolEnabled: false,
            };
  
            colorRendererCreator.createClassBreaksRenderer(params).then((rendererResponse) => {
              const newRenderer = rendererResponse.renderer;
              newRenderer.backgroundFillSymbol = {
                type: "simple-fill",
                outline: {
                  width: 1,
                  color: "gray",
                },
              };
  
              const breakInfos = newRenderer.classBreakInfos;
  
              // Update labels with descriptive text and format values
              breakInfos[0].label = `Very Low (${formatValue(breakInfos[0].minValue)} - ${formatValue(breakInfos[0].maxValue)})`;
              breakInfos[1].label = `Low (${formatValue(breakInfos[1].minValue)} - ${formatValue(breakInfos[1].maxValue)})`;
              breakInfos[2].label = `Medium (${formatValue(breakInfos[2].minValue)} - ${formatValue(breakInfos[2].maxValue)})`;
              breakInfos[3].label = `High (${formatValue(breakInfos[3].minValue)} - ${formatValue(breakInfos[3].maxValue)})`;
              breakInfos[4].label = `Very High (${formatValue(breakInfos[4].minValue)} - ${formatValue(breakInfos[4].maxValue)})`;
  
              const assignColorToClassBreaksRenderer = (nClass, colorList) => {
                for (let i = 0; i < nClass; i++) {
                  breakInfos[i].symbol.color = colorList[i];
                }
              };
  
              // Assign colors and update legend title based on thematic field
              let legendTitle = "Risk"; // Default title
              switch (thematicField) {
                case "risk":
                  assignColorToClassBreaksRenderer(breakInfos.length, riskColor);
                  legendTitle = "Risk";
                  break;
                case "hazard":
                  assignColorToClassBreaksRenderer(breakInfos.length, hzColor);
                  legendTitle = "Hazard";
                  break;
                case "vulnerabil":
                  assignColorToClassBreaksRenderer(breakInfos.length, vuColor);
                  legendTitle = "Vulnerability";
                  break;
                case "exposure":
                  assignColorToClassBreaksRenderer(breakInfos.length, ccColor);
                  legendTitle = "Exposure";
                  break;
                default:
                  assignColorToClassBreaksRenderer(breakInfos.length, riskColor);
                  legendTitle = "Risk";
              }
  
              // Update the legend title dynamically
              const legendNode = document.querySelector(".esri-legend__service-label");
              if (legendNode) {
                legendNode.textContent = legendTitle;
              }
  
              featureLayer.renderer = newRenderer;
            });
          };
  
          // Helper function to format values
          const formatValue = (value) => {
            return value === 0 || value === 1 ? value : value.toFixed(1);
          };
  
          const thematicDisplay = document.getElementById("thematic-display");
          thematicDisplay.addEventListener("calciteChipGroupSelect", (evt) => {
            const thematicField = evt.target.selectedItems[0].value;
            switch (thematicField) {
              case "risk":
                generateRenderer("risk");
                break;
              case "hz":
                generateRenderer("hazard");
                break;
              case "vu":
                generateRenderer("vulnerabil");
                break;
              case "ep":
                generateRenderer("exposure");
            }
          });
          thematicDisplay.loading = false;
        } else {
          this.displayError({
            name: `Can't Find Layer`,
            message: `The layer '${layerTitle}' can't be found in this map.`,
          });
        }
      });
    }
  }

  /**
   * Initialize map action functionality
   */
  initializeMapAction({ view }) {
    if (view) {
      require(["esri/core/reactiveUtils"], (reactiveUtils) => {
        // FEATURE LAYER //
        const layerTitle = "INDEX_INFO";
        const featureLayer = view.map.allLayers.find((layer) => layer.title === layerTitle);
  
        if (featureLayer) {
          let highlightHandle = null;
  
          view.whenLayerView(featureLayer).then((layerView) => {
            reactiveUtils.whenOnce(() => !layerView.updating).then(() => {
              view.on("click", (event) => {
                // Check if the Measurement Tool is active
                const measurementTool = document.querySelector("#toolbarDiv .esri-widget--button.active");
                if (measurementTool) {
                  // If the measurement tool is active, prevent feature clicking
                  console.log("Measurement tool is active. Feature clicking is disabled.");
                  return;
                }
  
                // Proceed with feature clicking logic if measurement tool is not active
                view
                  .hitTest(event, { include: featureLayer })
                  .then((response) => {
                    const graphicHits = response.results?.filter(
                      (hitResult) =>
                        hitResult.type === "graphic" &&
                        hitResult.graphic.layer === featureLayer
                    );
  
                    if (graphicHits?.length > 0) {
                      // Logic for when a feature is clicked
                      const feature = graphicHits[0].graphic;
  
                      // Ensure left panel is visible
                      const leftPanel = document.querySelector(
                        'calcite-shell-panel[slot="panel-start"]'
                      );
                      if (leftPanel.collapsed) {
                        leftPanel.collapsed = false;
                      }
  
                      // Highlight clicked feature
                      if (highlightHandle) {
                        highlightHandle.remove();
                        highlightHandle = null;
                      }
                      highlightHandle = layerView.highlight(feature);
  
                      // Update charts and details
                      this.updateCharts(feature);
                      this.updateDetails(feature, layerView);
  
                      // Ensure the right panel is visible
                      const rightPanel = document.getElementById("panel-stats-end");
                      if (rightPanel) rightPanel.collapsed = false;
                    } else {
                      // Logic for when no feature is clicked
                      this.clearCharts();
                      this.clearDetails(view, layerView);
  
                      // Collapse the right panel
                      const rightPanel = document.getElementById("panel-stats-end");
                      if (rightPanel) {
                        console.log("Collapsing right panel.");
                        rightPanel.collapsed = true; // Ensure this is executed
                      }
  
                      // Clear highlight
                      if (highlightHandle) {
                        highlightHandle.remove();
                        highlightHandle = null;
                      }
                    }
                  })
                  .catch((error) => {
                    console.error("Error during hitTest:", error);
                  });
              });
            });
          });
        } else {
          this.displayError({
            name: `Can't Find Layer`,
            message: `The layer '${layerTitle}' can't be found in this map.`,
          });
        }
      });
    }
  }

  /**
   * Initialize ranking functionality
   */
  initializeRank({view}) {
    if (view) {
      const numberFormatter = new Intl.NumberFormat('en-US');

      // FEATURE LAYER //
      const layerTitle = "INDEX_INFO";
      const featureLayer = view.map.allLayers.find(layer => layer.title === layerTitle);
      if (featureLayer) {
        featureLayer.load().then(() => {
          featureLayer.set({ outFields: ["*"] });

          // GET NUMBER OF ALL FEATURES FROM THE SERVICE AND USE THE COUNT //            
          featureLayer.queryFeatureCount().then((featureCount) => {
            document.getElementById("tablePager").setAttribute("total-items", featureCount);
          });

          const adminRankResultNode = document.getElementById("admin-rank-results");
          let page = 0;
          let graphics;
          let highlight;

          const updateRankList = async (rankField) => {
            let selectRankField = rankField || "risk";

            // GET THE INSTANCE OF THE LAYERVIEW //
            const layerView = await view.whenLayerView(featureLayer);

            const queryPage = async (page) => {
              const query = {
                start: page,
                num: 10,
                outFields: ["*"],
                returnGeometry: true,
                orderByFields: [`${selectRankField} DESC`]
              };
              const featureSet = await featureLayer.queryFeatures(query)
              convertFeatureSetToRows(featureSet, query);
              adminRankResultNode.loading = false;
            }

            const convertFeatureSetToRows = (featureSet) => {
              adminRankResultNode.innerHTML = "";
              graphics = featureSet.features;
              graphics.forEach((feature, index) => {
                const riskInfo = `Score: ${(feature.getAttribute(selectRankField)*10).toFixed(1)} out of 10`
                const adminName = `${feature.getAttribute("name_2")}, ${feature.getAttribute("name_1")}`;

                const itemButton = document.createElement("button");
                itemButton.className = "item-button";
                const itemCard = document.createElement("calcite-card");
                itemButton.appendChild(itemCard);

                const title = document.createElement("span");
                title.slot = "title";
                title.innerText = riskInfo;
                itemCard.appendChild(title);

                const summary = document.createElement("span");
                summary.slot = "subtitle";
                summary.innerText = adminName;
                itemCard.appendChild(summary);

                const chipState = document.createElement("calcite-chip");
                chipState.slot = "footer-start";
                chipState.scale = "s";
                chipState.icon = "group";
                chipState.innerText = numberFormatter.format(feature.getAttribute("total_popu"));
                itemCard.appendChild(chipState);

                const chip = document.createElement("calcite-chip");
                chip.icon = "locator";
                chip.slot = "footer-end";
                chip.scale = "s";
                chip.innerText = numberFormatter.format(feature.getAttribute("total_hh"));
                itemCard.appendChild(chip);

                adminRankResultNode.appendChild(itemButton);
              });
            }

            // FETCH THE FIRST 10 ADMINS //
            queryPage(page);

            // USER CLICKED ON THE PAGE NUMBER //
            document.getElementById("tablePager").addEventListener("calcitePaginationChange", (event) => {
                adminRankResultNode.loading = true
                if (event.target.startItem === 1) {
                  page = 0;
                } else {
                  page = event.target.startItem;
                }
                queryPage(page);
            });
          }

          const selectRankScore = document.getElementById("selectRankScore");
          selectRankScore.addEventListener("calciteRadioButtonGroupChange", () => {
            const rankField = selectRankScore.selectedItem.value;
            switch (rankField) {
              case "risk-rank":
                updateRankList("risk");
                break;
              case "hz-rank":
                updateRankList("hazard");
                break;
              case "vu-rank":
                updateRankList("vulnerabil");
                break;
              case "ep-rank":
                updateRankList("exposure");
            }
          });

          updateRankList();
        });
      } else {
        this.displayError({
          name: `Can't Find Layer`,
          message: `The layer '${layerTitle}' can't be found in this map.`,
        });
      }
    }
  }

  /**
   * Application ready handler
   */
  applicationReady({ portal, group, map, view }) {
    return new Promise(async (resolve, reject) => {
      // VIEW READY //
      this.configView({view}).then(() => {
        // Initialize all components
        this.initializePanelState();
        this.initializeUploadData({ portal, map, view });
        this.initializeCharts();
        this.initializeDisplayDetails({view});
        this.initializeMapDisplay({view});
        this.initializeMapAction({view});
        this.initializeRank({view});

        resolve();
      }).catch(reject);
    });
  }
}

export default new Application();