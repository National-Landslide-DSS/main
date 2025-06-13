export const createBarChart = (barNode) => {
  const barChart = new Chart(barNode, {
    type: "bar",
    data: {
      labels: [
        ["Hazard"],
        ["Vulnerability"],
        ["Exposure"],
      ],
      datasets: [{
        axis: "y",
        data: [0.0, 0.0, 0.0],
        backgroundColor: [
          "rgba(247, 135, 33, 0.8)", // Orange for Hazard
          "rgba(117, 85, 155, 0.8)", // Purple for Vulnerability
          "rgba(30, 144, 255, 0.8)"  // Blue for Exposure
        ],
        borderColor: [
          "rgba(247, 135, 33, 1)",
          "rgba(117, 85, 155, 1)",
          "rgba(30, 144, 255, 1)"
        ],
        borderWidth: 1,
        borderRadius: 2,
        borderSkipped: false,
        datalabels: {
          color: "black",
          anchor: "end",
          align: "right",
          offset: 0,
          font: {
            family: "'Times New Roman', Times, serif"
          }
        },
      }]
    },
    plugins: [ChartDataLabels],
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          right: 30, // Add padding to the right to extend the x-axis visually
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${context.raw.toFixed(1)}`,
            title: () => 'Risk Score'
          }
        },
        datalabels: {
          display: true,
          color: '#fff',
          anchor: 'end',
          align: 'end',
          offset: 0,
          font: {
            size: 12,
            family: "'Times New Roman', Times, serif"
          },
          formatter: (value) => value.toFixed(1)
        }
      },
      scales: {
        y: {
          ticks: { 
            autoSkip: false,
            font: {
              family: "'Times New Roman', Times, serif"
            }
          },
          grid: { display: false } // Remove grid lines on the y-axis
        },
        x: {
          min: 0,
          max: 10, // Keep the max value as 10
          ticks: {
            stepSize: 2,
            font: {
              family: "'Times New Roman', Times, serif"
            }
          },
          grid: {
            display: false, // Remove grid lines on the x-axis
          },
          title: {
            display: true,
            text: 'Risk Score',
            font: {
              family: "'Times New Roman', Times, serif"
            }
          }
        }
      }
    }
  });

  // Add helper methods
  barChart.updateData = function(data) {
    // Scale values from 0-1 to 1-10 range
    const scaledData = data.map(value => value * 10);
    this.data.datasets[0].data = scaledData;
    this.update();
  };

  barChart.clearData = function() {
    this.data.datasets[0].data = [0, 0, 0];
    this.update();
  };

  return barChart;
};