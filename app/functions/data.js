const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const Chart = require("chart.js");
require("chartjs-chart-financial"); // Import the financial plugin for Chart.js

const width = 800; // Chart width
const height = 600; // Chart height
const chartCallback = (ChartJS) => {
	// Register the plugin in Chart.js
	ChartJS.register(require("chartjs-chart-financial").CandlestickController);
};

const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, chartCallback });

const ohlcData = [
	{ x: new Date("2024-09-01"), o: 6619.31, h: 6628.13, l: 6610.89, c: 6623.42 },
	{ x: new Date("2024-09-02"), o: 6623.43, h: 6632.15, l: 6615.53, c: 6624.61 },
	// Add more data points here
];

(async () => {
	const configuration = {
		type: "candlestick",
		data: {
			datasets: [
				{
					label: "Candlestick Data",
					data: ohlcData,
				},
			],
		},
		options: {
			scales: {
				x: {
					type: "time",
					time: {
						unit: "day",
					},
				},
				y: {
					beginAtZero: false,
				},
			},
		},
	};

	const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
	const fs = require("fs");
	fs.writeFileSync("candlestick-chart.png", imageBuffer);
	console.log("Chart saved as candlestick-chart.png");
})();
