/** Declare variables */
const fsURL =
  "https://nsdi.systems.gov.bt/server/rest/services/Hosted/INDEX_INFO/FeatureServer/0";
const fsFields = [
  "risk", // main risk index field
  "hazard",
  "vulnerabil",
  "exposure",
];
const adminFields = [
  "name_2",
  "name_1"
];

const riskColor = ["#FFFDFB", "#F5C5AB", "#E19884", "#DB6857", "#C93636"];
const hzColor = ["#FFFDFB", "#FFF1E2", "#FEDCBA", "#FCB16C", "#F78721"];
const vuColor = ["#FCFBFD", "#EDE8F4", "#CFC4E0", "#A68FC5", "#75559B"];
const epColor = [
  "#E6F2FF", // very light blue
  "#99CCFF", // light blue
  "#66B2FF", // medium blue
  "#3399FF", // blue
  "#1E90FF"  // Dodger Blue (main)
];

// Chart data - you'll need to replace these with actual data from your feature attributes
const hzLabels = ["Landslide Susceptibility Index", "Extreme Precipitation Susceptibility Index"];
const vuLabels = [ "Reinforced Structures", "Non-reinforced Structures",];
const epLabels = ["Population Density Index", "Household Density Index"];

/** End Declare variables */

require([
  "esri/core/urlUtils",
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/smartMapping/renderers/color",
  "esri/widgets/Legend",
], (urlUtils, Map, MapView, FeatureLayer, colorRendererCreator, Legend) =>
  (async () => {
    document.getElementById("btnPrint").addEventListener("click", () => {
      window.print();
    });

    // UPDATE DATE TIME //
    const dateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const formattedDate = dateFormatter.format(new Date());
    document.getElementById("today-date").innerHTML = formattedDate;

    const urlObject = urlUtils.urlToObject(document.location.href);

    let featureGeometry;
    let featureAttributes;

    if (urlObject.query) {
      const featureLayer = new FeatureLayer({
        url: fsURL,
      });
  
      let query = featureLayer.createQuery();
      query.where = `${adminFields[0]} = '${urlObject.query.id}'`; // Ensure 'name_1' exists in the layer
      query.outFields = ["*"];

      const queryResult = await featureLayer.queryFeatures(query);
      const features = queryResult.features;

      if (features.length > 0) {
        featureGeometry = features[0].geometry.extent; // Use features[0]
        featureAttributes = features[0].attributes;
      } else {
        console.log("No features found for the given ID:", urlObject.query.id);
        return;
      }

    } else {
      console.log("no url parameter");
      return;
    }

    // Set admin names
    const adminNode = document.getElementById("admin-node");
    const adminNames = adminFields.map(adminField => featureAttributes[adminField]);
    adminNode.innerHTML = adminNames.join(", ");

    // SUMMARY SECTION //
    const adminSum = document.getElementById("admin-sum-name");
    adminSum.innerHTML = adminNames.join(", ");
    const summaryScore = document.getElementById("summary-score");
    summaryScore.innerHTML = scaleTo10(featureAttributes[fsFields[0]], 0, 1).toFixed(1); // risk (scaled 0-10)
    const summaryClass = document.getElementById("summary-class");
    summaryClass.innerHTML = getRiskClass(scaleTo10(featureAttributes[fsFields[0]], 0, 1));

    // Set hazard section values
    document.getElementById("hz-class").innerHTML = getRiskClass(scaleTo10(featureAttributes["hazard"], 0, 1));
    document.getElementById("hz-risk-score").innerHTML = scaleTo10(featureAttributes["hazard"], 0, 1).toFixed(1);
    document.getElementById("hz-admin-name").innerHTML = adminNames.join(", ");
    
    // Set vulnerability section values
    document.getElementById("vu-class").innerHTML = getRiskClass(scaleTo10(featureAttributes["vulnerabil"], 0, 1));
    document.getElementById("vu-risk-score").innerHTML = scaleTo10(featureAttributes["vulnerabil"], 0, 1).toFixed(1);
    document.getElementById("vu-admin-name").innerHTML = adminNames.join(", ");
    
    // Set exposure section values
    document.getElementById("ep-class").innerHTML = getRiskClass(scaleTo10(featureAttributes["exposure"], 0, 1));
    document.getElementById("ep-risk-score").innerHTML = scaleTo10(featureAttributes["exposure"], 0, 1).toFixed(1);
    document.getElementById("ep-admin-name").innerHTML = adminNames.join(", ");

    // DIMENSIONS BAR CHART //
    const dimensionsChartNode = document.getElementById("dimensions-bar-chart");
    const dimensionsBarChart = createBarChart(dimensionsChartNode);

    function scale01to10(arr) {
      return arr.map(attributeValue => (attributeValue * 10).toFixed(1));
    }
    
    // UPDATE DIMENSION CHART DATA //
    let dimensionStats = [
      featureAttributes[fsFields[1]], // hazard
      featureAttributes[fsFields[2]], // vulnerability
      featureAttributes[fsFields[3]]  // exposure
    ];
    let dimensionStatsScaled = scale01to10(dimensionStats); // Now 1-10 values
    dimensionsBarChart.data.datasets[0].data = dimensionStatsScaled;
    dimensionsBarChart.update();

    // CREATE POLAR CHARTS //
    // Hazard polar chart
    const hzLabels = [
      "Landslide Susceptibility Index",
      "Extreme Precipitation Susceptibility Index"
    ];
    const hzChartNode = document.getElementById("hz-chart-node");
    const hzPolarChart = createPolarChart(hzChartNode, hzLabels, "#F78721");
    const hzData = [
      +scaleTo10(featureAttributes["suscl"] || 0, 0, 1).toFixed(1),
      +scaleTo10(featureAttributes["epsi"] || 0, 0, 1).toFixed(1)
    ];
    const hzColors = getRankedShades("#F78721", hzData);
    hzPolarChart.data.datasets[0].data = hzData;
    hzPolarChart.data.datasets[0].backgroundColor = hzColors;
    hzPolarChart.update();
    
    
    const totalHouseholds = featureAttributes["total_hh"] || 0;
    const reinforced = featureAttributes["rc_wrs"] || 0;
    const nonReinforced = featureAttributes["rc_wors"] || 0;
    const bricksStone = featureAttributes ["ctcm_bs"] || 0;
     const adobe = featureAttributes ["ctcm_adobe"] || 0;

    const reinforcedPct = totalHouseholds ? (reinforced / totalHouseholds) * 100 : 0;
    const nonReinforcedPct = totalHouseholds ? (nonReinforced / totalHouseholds) * 100 : 0;
    const brickstonePct = totalHouseholds ? (bricksStone / totalHouseholds) * 100 : 0;
    const adobePct = totalHouseholds ? (adobe / totalHouseholds) * 100 : 0;

    // Vulnerability polar chart (remove Total Households from chart)
    const vuLabels = [
      "Reinforced Structures (%)",
      "Non-reinforced Structures (%)",
      "Bricks & Stone Structures (%)",
      "Adobe Structures (%)"
    ];
    const vuChartNode = document.getElementById("vu-chart-node");
    const vuPolarChart = createPolarChart(vuChartNode, vuLabels, "#75559B", 100); // max = 100 for vulnerability
    const vuData = [
      reinforcedPct,
      nonReinforcedPct,
      brickstonePct,
      adobePct
    ];
    const vuColors = getRankedShades("#75559B", vuData);
    vuPolarChart.data.datasets[0].data = vuData;
    vuPolarChart.data.datasets[0].backgroundColor = vuColors;
    vuPolarChart.update();
    
    // Exposure polar chart
    const epLabels = [
      "Population Density Index",
      "Household Density Index"
    ];
    const epChartNode = document.getElementById("ep-chart-node");
    // Use "#1E90FF" for Dodger Blue to match the bar chart
    const epPolarChart = createPolarChart(epChartNode, epLabels, "#1E90FF");
    const epData = [
      scaleTo10(featureAttributes["pd"] || 0, 0, 1),
      scaleTo10(featureAttributes["hd"] || 0, 0, 1)
    ];
    const epColors = getRankedShades("#1E90FF", epData);
    epPolarChart.data.datasets[0].data = epData;
    epPolarChart.data.datasets[0].backgroundColor = epColors;
    epPolarChart.update();

    // Create Exposure polar chart 2 for population details
    const epLabels2 = [
      "Male Population (%)",
      "Female Population (%)",
      "Population Below Age 5 (%)",
      "Population Above Age 65 (%)"
    ];
    const epChartNode2 = document.getElementById("ep-chart-node-2");

    // Compute population values (update the field names if necessary)
    const totalPopulation = featureAttributes["total_popu"] || 0;
    const malePop = featureAttributes["male"] || 0;
    const femalePop = featureAttributes["female"] || 0;
    const below5 = featureAttributes["age__5"] || 0;
    const above65 = featureAttributes["age__65"] || 0;
    const malePopPct = totalPopulation ? (malePop / totalPopulation) * 100 : 0;
    const femalePopPct = totalPopulation ? (femalePop / totalPopulation) * 100 : 0;
    const below5Pct = totalPopulation ? (below5 / totalPopulation) * 100 : 0;
    const above65Pct = totalPopulation ? (above65 / totalPopulation) * 100 : 0;

    const epPolarChart2 = createPolarChart(epChartNode2, epLabels2, "#1E90FF", 100);
    const epData2 = [
      malePopPct,
      femalePopPct,
      below5Pct,
      above65Pct
    ];
    const epColors2 = getRankedShades("#1E90FF", epData2);
    epPolarChart2.data.datasets[0].data = epData2;
    epPolarChart2.data.datasets[0].backgroundColor = epColors2;
    epPolarChart2.update();

    // OPTIONAL: Update corresponding table cells with the percentage values
    document.getElementById('ep-score3').innerHTML = epPolarChart2.data.datasets[0].data[0].toFixed(1);
    document.getElementById('ep-score4').innerHTML = epPolarChart2.data.datasets[0].data[1].toFixed(1);
    document.getElementById('ep-score5').innerHTML = epPolarChart2.data.datasets[0].data[2].toFixed(1);

    // UPDATE ALL TABLES //
    // HAZARD TABLE //
    document.getElementById('hz-score1').innerHTML = hzPolarChart.data.datasets[0].data[0].toFixed(1);
    document.getElementById('hz-score2').innerHTML = hzPolarChart.data.datasets[0].data[1].toFixed(1);

    // VULNERABILITY TABLE //
    document.getElementById('vu-score1').innerHTML = totalHouseholds; // Total Households (normalized)
    document.getElementById('vu-score2').innerHTML = reinforced; // Reinforced Structures (%)
    document.getElementById('vu-score3').innerHTML = nonReinforced; // Non-reinforced Structures (%)
    document.getElementById('vu-score4').innerHTML = bricksStone;
    document.getElementById('vu-score5').innerHTML = adobe;

    // EXPOSURE TABLE //
    document.getElementById('ep-score1').innerHTML = epPolarChart.data.datasets[0].data[0].toFixed(1);
    document.getElementById('ep-score2').innerHTML = epPolarChart.data.datasets[0].data[1].toFixed(1);

    // EXPOSURE TABLE //
    document.getElementById('ep-score3').innerHTML = malePop;
    document.getElementById('ep-score4').innerHTML = femalePop;
    document.getElementById('ep-score5').innerHTML = below5;
    document.getElementById('ep-score6').innerHTML = above65;


    // CREATE RISK LAYER AND VIEWS //
    createRiskLayerAndView(fsFields[0], "viewRisk", "legendRisk", riskColor);
    createRiskLayerAndView(fsFields[1], "viewHZ", "legendHZ", hzColor);
    createRiskLayerAndView(fsFields[2], "viewVU", "legendVU", vuColor);
    createRiskLayerAndView(fsFields[3], "viewEP", "legendEP", epColor);

    // Helper function to classify risk scores
    function getRiskClass(score) {
      if (score < 2) return "Very Low";
      if (score < 4) return "Low";
      if (score < 6) return "Medium";
      if (score < 8) return "High";
      return "Very High";
    }

    function createBarChart(barNode) {
      const chart = new Chart(barNode, {
        type: "bar",
        data: {
          labels: ["Hazard", "Vulnerability", "Exposure"],
          datasets: [{
            axis: "y",
            data: [0.0, 0.0, 0.0],
            backgroundColor: ["rgba(247, 135, 33, 0.8)", "rgba(117, 85, 155, 0.8)", "rgba(30, 144, 255, 0.8)"],
            borderRadius: 2,
            datalabels: {
              color: "black",         // Make label text black
              anchor: "end",          // Position label outside the bar
              align: "right",         // Align label to the right of the bar
              offset: 0,              // Space between bar and label
              font: {
                size: 12,
                fontFamily: "'Times New Roman', sans-serif",

              }
            },
          }],
        },
        plugins: [ChartDataLabels],
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: {
              right: 30
            }
          },
          plugins: {
            legend: false,
            datalabels: {
              color: "black",
              anchor: "end",
              align: "right",
              offset: 0,
              font: {
                size: 12,
                fontFamily: "'Times New Roman', sans-serif",
              },
              formatter: function(value) {
                return value; // Show the value as is
              }
            },
            tooltip: {
              enabled: true,
              callbacks: {
                title: (context) => context[0].label,
                label: function(context) {
                  if (context.dataIndex === 0) {
                    return "The likelihood of landslide events based on extreme precipitation";
                  } else if (context.dataIndex === 1) {
                    return "The susceptibility of terrain and infrastructure to landslides";
                  } else {
                    return "Population and assets at risk from landslide events";
                  }
                },
              },
            },
          },
          scales: {
            y: {
              ticks: { autoSkip: false },
            },
            x: {
              min: 0,
              max: 10,
              ticks: { stepSize: 2 },
              grid: { display: false },
            },
          },
        },
      });

      // Add a method to update the chart data dynamically
      chart.updateData = function(newData) {
      if (!Array.isArray(newData) || newData.length !== 3) {
        console.error("Invalid data format. Expected an array of 3 numbers.");
        return;
      }

      console.log("Updating bar chart data (normalized):", normalizedData); // Debugging line
      this.data.datasets[0].data = normalizedData;
      this.update();
    };

      return chart;
    }
    

    function createPolarChart(chartNode, labels, color, maxValue = 10) {
      return new Chart(chartNode, {
        type: 'polarArea',
        data: {
          labels: labels,
          datasets: [{
            data: new Array(labels.length).fill(0),
            backgroundColor: [
              `${color}80`,
              `${color}90`,
              `${color}A0`,
              `${color}B0`,
              `${color}C0`,
              `${color}D0`
            ],
            borderColor: color,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
              position: 'right',
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.label}: ${context.raw.toFixed(1)}`;
                }
              }
            }
          },
          scales: {
            r: {
              min: 0,
              max: maxValue, // Use the custom max value
              ticks: {
                stepSize: maxValue === 100 ? 20 : 2,
                display: true,
                callback: (val) => val,
                font: {
                  size: 11,
                  family: "'Times New Roman', sans-serif",
                },
                z: 10
              },
              pointLabels: {
                centerPointLabels: true,
                display: true,
                font: {
                  size: 12,
                  family: "'Times New Roman', sans-serif",
                },
                color: "black",
                backdropColor: "rgba(0, 0, 0, 0)",
              },
              angleLines: {
                display: true,
                lineWidth: 1
              },
            }
          }
        }
      });
    }

    function createRiskLayerAndView(layerTitle, viewDiv, legendDiv, colorScheme) {
      const layer = new FeatureLayer({
        url: fsURL,
        labelingInfo: [{
          labelExpressionInfo: {
            expression: "$feature.name_2",
          }
        }],
        outFields: ["*"],
      });

      const view = new MapView({
        container: viewDiv,
        map: new Map({
          basemap: "topo-vector",
          layers: [layer],
        }),
        ui: { components: [] },
        constraints: { rotationEnabled: false },
        highlightOptions: { fillOpacity: 0 }
      });

      new Legend({
        view: view,
        container: legendDiv,
        layerInfos: [{
          layer: layer,
          title: "Legend",
        }],
      });

      view.when(() => {
        disableZooming(view);
        generateRenderer(view, layer, layerTitle, colorScheme);
        view.goTo({
          target: featureGeometry,
          zoom: 9
        });

        view.whenLayerView(layer).then((layerView) => {
          // Use the correct unique field for highlight
          const objectIdField = layer.objectIdField || "OBJECTID";
          const highlightId = featureAttributes[objectIdField] || featureAttributes["id_2"];
          if (highlightId !== undefined) {
            layerView.highlight(highlightId);

            // Add featureEffect for selection
            layerView.featureEffect = {
              filter: {
                where: `id_2 = ${featureAttributes["id_2"]}`
              },
              excludedLabelsVisible: true,
            };
          } else {
            console.warn("No valid ID found for highlight.");
          }
        });
      }, (error) => {
        console.error(error);
      });
    }

    function disableZooming(view) {
      view.popup.actions = [];
      view.ui.components = [];

      function stopEvtPropagation(event) {
        event.stopPropagation();
      }

      view.on("mouse-wheel", stopEvtPropagation);
      view.on("double-click", stopEvtPropagation);
      view.on("double-click", ["Control"], stopEvtPropagation);
      view.on("drag", stopEvtPropagation);
      view.on("drag", ["Shift"], stopEvtPropagation);
      view.on("drag", ["Shift", "Control"], stopEvtPropagation);

      view.on("key-down", (event) => {
        const prohibitedKeys = [
          "+", "-", "Shift", "_", "=",
          "ArrowUp", "ArrowDown", "ArrowRight", "ArrowLeft",
        ];
        if (prohibitedKeys.includes(event.key)) {
          event.stopPropagation();
        }
      });
    }

    function generateRenderer(view, featureLayer, thematicField, colorScheme) {
      const params = {
        view: view,
        layer: featureLayer,
        field: thematicField,
        classificationMethod: "equal-interval",
        numClasses: 5,
        defaultSymbolEnabled: false,
      };

      colorRendererCreator
        .createClassBreaksRenderer(params)
        .then((rendererResponse) => {
          const newRenderer = rendererResponse.renderer;
          const breakInfos = newRenderer.classBreakInfos;

          breakInfos[0].label = `Very Low (${breakInfos[0].minValue.toFixed(1)} - ${breakInfos[0].maxValue.toFixed(1)})`;
          breakInfos[1].label = `Low (${breakInfos[1].minValue.toFixed(1)} - ${breakInfos[1].maxValue.toFixed(1)})`;
          breakInfos[2].label = `Medium (${breakInfos[2].minValue.toFixed(1)} - ${breakInfos[2].maxValue.toFixed(1)})`;
          breakInfos[3].label = `High (${breakInfos[3].minValue.toFixed(1)} - ${breakInfos[3].maxValue.toFixed(1)})`;
          breakInfos[4].label = `Very High (${breakInfos[4].minValue.toFixed(1)} - ${breakInfos[4].maxValue.toFixed(1)})`;

          for (let i = 0; i < breakInfos.length; i++) {
            breakInfos[i].symbol.color = colorScheme[i];
          }
          
          featureLayer.renderer = newRenderer;
        });
    }

    function scaleTo10(raw, min, max) {
      if (max === min) return 0;
      return Math.max(0, Math.min(10, ((raw - min) / (max - min)) * 10));
    }

    function getRankedShades(baseColor, values) {
      // baseColor: e.g. "#F78721"
      // values: array of numbers (0-10)
      // Returns an array of rgba colors, lighter overall
      const hex = baseColor.replace('#', '');
      const r = parseInt(hex.substring(0,2), 16);
      const g = parseInt(hex.substring(2,4), 16);
      const b = parseInt(hex.substring(4,6), 16);
    
      // Rank values (higher value = more vibrant)
      const sorted = [...values].slice().sort((a, b) => b - a);
      return values.map(val => {
        const rank = sorted.indexOf(val);
        // alpha: 0.65 (most vibrant) to 0.45 (lightest)
        const alpha = 0.65 - (rank / (values.length - 1)) * 0.4; // 0.85 to 0.45
        return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
      });
    }

  })());