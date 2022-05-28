'use strict';
const ccxt = require('ccxt');
const config = require('../config/config')

const _Grid = []
// 网格距离
const _GridPointDis = config.GRID_DISTANCE;
// 操作方向，尽量做多，做空风险高
const direction = config.GRID_DIRECTION;
// 网格每次下单量
const _GridPointAmount = config.GRID_BUY_QUANTITY;
// 网格节点平仓差价
const _GridCovDis = config.GRID_STOP_EARN;
// 网格数量
const _GridNum = config.GRID_NUM;
// 网格策略开启价格
const startPrice = config.GRID_START_PRICE;

const exchange = connectBinance();
setInterval(async () => {
    await getPrice()
}, 500);

async function getPrice() {
    return await exchange.fetchTicker(config.COIN);
}

function UpdateGrid(nowBidsPrice, nowAsksPrice, direction) {
    // 做多方向，当前价位小于网格最后一次购买价格，并超过了一个网格间距，进行下单
    // 如果当前网格中无数据，则直接下单
    if (_Grid.length === 0 || (direction === 1 && nowBidsPrice - _Grid[_Grid.length - 1].price > _GridPointDis) ||
        (direction === -1 && _Grid[_Grid.length - 1].price - nowAsksPrice > _GridPointDis)) {

        let nowPrice = direction === 1 ? nowBidsPrice : nowAsksPrice
        _Grid.push({
            // 开仓价
            price: _Grid.length === 0 ? nowPrice : _Grid[_Grid.length - 1].price + _GridPointDis * direction,
            // 当前持有数量
            hold: {price: 0, amount: 0},
            // 平仓价位
            coverPrice: nowPrice + direction * _GridPointDis
        });

        let tradeInfo = direction === 1 ? $.Sell(_GridPointAmount) : $.Buy(_GridPointAmount)
        _Grid[_Grid.length - 1].hold.price = tradeInfo.price;
        _Grid[_Grid.length - 1].hold.amount = tradeInfo.amount;
    }
    // 卖出
    // 如果当前价格超过栈顶的平仓价，则平仓
    if (_Grid.length > 0 &&
            ((direction === 1 && nowAsksPrice >= _Grid[_Grid.length - 1].coverPrice) ||
            (direction === -1 && nowBidsPrice <= _Grid[_Grid.length - 1].coverPrice))) {
        let coverInfo = direction === 1 ? $.Sell(_Grid[_Grid.length - 1].hold.amount) :
            $.Buy(_Grid[_Grid.length - 1].hold.amount);
        _Grid.pop()
    }
}

function main() {
    let isStart = false;
    setInterval(() => {
        const priceObj = getPrice();
        if (!isStart && ((direction === 1 && priceObj.bid <= startPrice) || (direction === -1 && priceObj.bid >= startPrice))) {
            isStart = true;
        }
        UpdateGrid(priceObj.bid, priceObj.ask, direction);
    }, 500);
}

function connectBinance() {
    const exchangeId = 'binance';
    const exchangeClass = ccxt[exchangeId];
    return new exchangeClass({
        'apiKey': config.API_KEY,
        'secret': config.SECRET_KEY,
    });
}

