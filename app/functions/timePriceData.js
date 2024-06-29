"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTimeAndPriceGraph = void 0;
var fetchCandlestickData_1 = require("./fetchCandlestickData");
var fetchCoins_1 = require("./fetchCoins");
var quickchart_js_1 = require("quickchart-js");
function unixToDateTime(unixTime) {
    var milliseconds = unixTime * 1000;
    var dateObject = new Date(milliseconds);
    return dateObject;
}
var generateTimeAndPriceGraph = function (address, timeframe, chain) { return __awaiter(void 0, void 0, void 0, function () {
    var startTime, endTime, data, coinData, historicalData, last12Items, timeAndPrice, myPriceChart, url;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                startTime = Math.floor((Date.now() - 12 * 24 * 60 * 60 * 1000) / 1000);
                endTime = Math.floor(Date.now() / 1000);
                return [4 /*yield*/, (0, fetchCandlestickData_1.fetchOHLCVData)(address, "usd", timeframe, startTime, endTime, chain)];
            case 1:
                data = _a.sent();
                return [4 /*yield*/, (0, fetchCoins_1.fetchCoin)(address, chain)];
            case 2:
                coinData = _a.sent();
                //console.log(coinData)
                if (!data)
                    return [2 /*return*/, null];
                historicalData = data.items;
                last12Items = historicalData.slice(-12);
                timeAndPrice = {
                    timeframe: timeframe,
                    time: last12Items.map(function (item) { return unixToDateTime(item.unixTime).toLocaleTimeString().slice(0, -3); }),
                    price: last12Items.map(function (item) { return item.h; }),
                    timeOfReq: "This chart was created on ".concat(new Date().toLocaleDateString(), " at ").concat(new Date().toLocaleTimeString()),
                    coinData: coinData,
                };
                myPriceChart = new quickchart_js_1.default();
                myPriceChart.setConfig({
                    type: "line",
                    data: {
                        labels: timeAndPrice.time,
                        datasets: [
                            {
                                label: "".concat(timeAndPrice.timeframe, " chart"),
                                data: timeAndPrice.price,
                                borderColor: timeAndPrice.price[0] > timeAndPrice.price[11] ? "red" : "green",
                                backgroundColor: "transparent",
                            },
                        ],
                    },
                });
                return [4 /*yield*/, myPriceChart.getUrl()];
            case 3:
                url = _a.sent();
                // console.log(url);
                // console.log("here too");
                // const buf = await myPriceChart.toBinary();
                //console.log(await myPriceChart.getUrl());
                //console.log(buf);
                return [2 /*return*/, { timeAndPrice: timeAndPrice, url: url }];
        }
    });
}); };
exports.generateTimeAndPriceGraph = generateTimeAndPriceGraph;
