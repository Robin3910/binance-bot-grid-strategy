'use strict';
const ccxt = require('ccxt');
const config = require('../config/config')
const util = require('../util/common')
const api = require('../util/api');
// 导入WebSocket模块:
const WebSocket = require('ws');

const _Grid = []
// 操作方向，尽量做多，做空风险高
const direction = config.GRID_DIRECTION;
//const _GridPointAmount = config.GRID_BUY_QUANTITY;
// 区间上限
const topPrice = config.GRID_TOP_PRICE;
// 区间下限
const bottomPrice = config.GRID_BOTTOM_PRICE;
// 网格策略开启价格
const startPrice = (topPrice - bottomPrice) / 2 + bottomPrice;
// 初始资金
let initMoney = config.INIT_MONEY;
// 网格每次交易量占开启价格的百分点，比如0.005，策略开启价格为29500，则每个网格距离为 29500 *0.005 = 147.5
const gridPercent = config.GRID_PERCENT;
// 网格距离
const _GridPointDis = startPrice * gridPercent;
// 网格每次下单量
const _GridPointAmount = initMoney / ((startPrice - bottomPrice) / _GridPointDis);
// 最大下单量
const maxGridNum = (startPrice - bottomPrice) / _GridPointDis;

let isHandling = false;

// 生成listenKey并订阅市场消息
api.createListenKey().then((data) => {
    console.log(data.listenKey);
    let ws = new WebSocket(`wss://fstream-auth.binance.com/ws/${config.COIN}@markPrice?listenKey=${data.listenKey}`);

    // 打开WebSocket连接后立刻发送一条消息:
    ws.on('open', function () {
        console.log(`[CLIENT] open()`);
        ws.send('Hello!');
    });

    // 响应收到的消息:
    ws.on('message', function (message) {
        if(isHandling) {
            console.log('bot is handle previous price...');
            return;
        }
        console.log(`[CLIENT] Received: ${message}`);
        const price = message.p;
        UpdateGrid(price, price, direction, message.e);
    });
});



function UpdateGrid(nowBidsPrice, nowAsksPrice, direction, ts) {
    isHandling = true;
    // 先判断是否要卖出
    // 如果当前价格超过栈顶的平仓价，则平仓
    if (_Grid.length > 0 &&
        ((direction === 1 && nowBidsPrice >= _Grid[_Grid.length - 1].coverPrice) ||
            (direction === -1 && nowAsksPrice <= _Grid[_Grid.length - 1].coverPrice))) {
        // let coverInfo = direction === 1 ? $.Sell(_Grid[_Grid.length - 1].hold.amount) :
        //     $.Buy(_Grid[_Grid.length - 1].hold.amount);
        _Grid.pop();
        initMoney += _GridPointAmount * gridPercent;
        console.log(`sell |time: ${util.transTimeStampToDate(data[index - 1][0])}| price: ${nowBidsPrice} | cur asset: ${initMoney}| cur position: ${_Grid.length}`);
    }
    // 再判断是否要买入
    // 如果当前网格中无数据，且满足低位条件（当前价格小于策略运行价格），进行下单
    if ((_Grid.length === 0)
        // 做多方向，当前价位小于网格最后一次购买价格，并超过了一个网格间距，进行下单
        || (direction === 1 && _Grid[_Grid.length - 1].price - nowAsksPrice > _GridPointDis)
        // 做空方向，当前价位大于网格最后一次购买价格，并超过了一个网格间距，进行下单
        || (direction === -1 && nowBidsPrice - _Grid[_Grid.length - 1].price > _GridPointDis)) {
        if (_Grid.length >= maxGridNum) {
            return;
        }

        if ((direction === 1 && nowBidsPrice <= startPrice) || (direction === -1 && nowAsksPrice >= startPrice)) {
            let nowPrice = direction === 1 ? nowAsksPrice : nowBidsPrice;
            _Grid.push({
                // 开仓价
                price: nowPrice,
                // 当前持有数量
                hold: {price: 0, amount: 0},
                // 平仓价位
                coverPrice: nowPrice + direction * _GridPointDis
            });


            // let tradeInfo = direction === 1 ?  : $.Buy(_GridPointAmount)
            _Grid[_Grid.length - 1].hold.price = nowPrice;
            _Grid[_Grid.length - 1].hold.amount = _GridPointAmount;
            console.log(`buy in|time: ${util.transTimeStampToDate(data[index - 1][0])} | price: ${nowPrice} | cur position: ${_Grid.length}`);
        }
    }

    isHandling = false;
}

function main() {
    let isStart = false;
    setInterval(async () => {
        // const priceObj = await getPrice();
        const priceObj = {};
        if (!isStart && ((direction === 1 && priceObj.bid <= startPrice) || (direction === -1 && priceObj.bid >= startPrice))) {
            isStart = true;
            console.log(`strategy start, cur price: ${priceObj.bid}`);
        }
        UpdateGrid(priceObj.bid, priceObj.ask, direction);
    }, 1000);
}

// time, open, highest, lowest, close, volume

// main();

