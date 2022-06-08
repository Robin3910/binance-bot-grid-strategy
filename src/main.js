'use strict';
const config = require('../config/config');
const util = require('../util/common');
const api = require('../util/api');
const fs = require('fs');
// 导入WebSocket模块
const WebSocket = require('ws');

const _Grid = []
// 操作方向，尽量做多，做空风险高
const direction = config.GRID_DIRECTION;
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

fs.writeFileSync(config.LOG_FILE_PATH, `bot start|${util.transTimeStampToDate(Date.now())}|topPrice: ${topPrice}| bottomPrice: ${bottomPrice}|startPrice: ${startPrice}|gridDistance:${_GridPointDis}|gridAmount: ${_GridPointAmount}|maxGridNum: ${maxGridNum}\n`, {flag: 'a+'});

// 匹配次数
let matchCount = 0;
// 当前是否在处理
let isHandling = false;
// 策略是否开始运行（达到触发价格后才会开始运行）
let isStart = false;
// 通知手机bot正常
let notifyCountDown = 0;

async function queryOrderStatus(orderId, retryTime) {
    console.log(`query orders...`);
    let queryOrder = await api.querySingleOrder({
        symbol: config.COIN,
        orderId: orderId
    });
    // 查询的订单如果已经成交或取消。如果queryOrder的orderId查不到，则说明挂单已成交
    while (queryOrder.orderId) {
        if (!retryTime) {
            console.log(`place order failed. wait for next tick`);
            break;
        }
        console.log(`query order | remain retryTime: ${retryTime}`);
        queryOrder = await api.querySingleOrder({
            symbol: config.COIN,
            orderId: orderId
        });
        retryTime--;
    }
    // 订单已成交返回true
    return !queryOrder.orderId;
}

async function UpdateGrid(nowBidsPrice, nowAsksPrice, direction, ts) {
    isHandling = true;
    // 先判断是否要卖出
    // 如果当前价格超过栈顶的平仓价，则平仓
    if (_Grid.length > 0 &&
        ((direction === 1 && nowBidsPrice >= _Grid[_Grid.length - 1].coverPrice) ||
            (direction === -1 && nowAsksPrice <= _Grid[_Grid.length - 1].coverPrice))) {

        // 下卖单
        const orderRes = await api.placeOrder({
            symbol: config.COIN,
            type: 'MARKET',
            side: 'SELL',
            quantity: parseFloat((_GridPointAmount / nowBidsPrice).toFixed(3))
        });

        console.log(`sell order success: ${orderRes['orderId']}`);
        _Grid.pop();
        const logStr = `sell |time: ${util.transTimeStampToDate(ts)}| price: ${nowBidsPrice} | cur position: ${_Grid.length}| matchCount: ${++matchCount}\n`;
        console.log(logStr);
        fs.writeFileSync(config.LOG_FILE_PATH, logStr, {flag: 'a+'});
        util.notifyToPhone(logStr);

        // // 查看订单是否已经成交
        // const orderStatus = await queryOrderStatus(orderRes['orderId'], 3);
        //
        // // 如果成交，则记录
        // if (orderStatus) {
        //     console.log(`sell order success: ${orderRes['orderId']}`);
        //     _Grid.pop();
        //     const logStr = `sell |time: ${util.transTimeStampToDate(ts)}| price: ${nowBidsPrice} | cur position: ${_Grid.length}| matchCount: ${++matchCount}\n`;
        //     console.log(logStr);
        //     fs.writeFileSync(config.LOG_FILE_PATH, logStr, {flag: 'a+'});
        //     util.notifyToPhone(logStr);
        //
        // } else {
        //     // 撤销订单
        //     api.cancelOrder({
        //         symbol: config.COIN,
        //         orderId: orderRes['orderId']
        //     });
        // }
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

            const orderRes = await api.placeOrder({
                symbol: config.COIN,
                type: 'MARKET',
                side: 'BUY',
                quantity: parseFloat((_GridPointAmount / nowBidsPrice).toFixed(3))
            });

            _Grid.push({
                // 开仓价
                price: nowPrice,
                // 当前持有数量
                hold: {price: nowPrice, amount: _GridPointAmount / nowBidsPrice},
                // 平仓价位
                coverPrice: nowPrice + direction * _GridPointDis
            });

            _Grid[_Grid.length - 1].hold.price = nowPrice;
            _Grid[_Grid.length - 1].hold.amount = _GridPointAmount;
            const logStr = `buy in|time: ${util.transTimeStampToDate(ts)}| buy order: ${orderRes['orderId']}| price: ${nowPrice} | cur position: ${_Grid.length}\n`;
            console.log(logStr);
            fs.writeFileSync(config.LOG_FILE_PATH, logStr, {flag: 'a+'});
            util.notifyToPhone(logStr);

            // const orderStatus = await queryOrderStatus(orderRes['orderId'], 3);
            //
            // if (orderStatus) {
            //     _Grid.push({
            //         // 开仓价
            //         price: nowPrice,
            //         // 当前持有数量
            //         hold: {price: nowPrice, amount: _GridPointAmount / nowBidsPrice},
            //         // 平仓价位
            //         coverPrice: nowPrice + direction * _GridPointDis
            //     });
            //
            //     _Grid[_Grid.length - 1].hold.price = nowPrice;
            //     _Grid[_Grid.length - 1].hold.amount = _GridPointAmount;
            //     const logStr = `buy in|time: ${util.transTimeStampToDate(ts)}| buy order: ${orderRes['orderId']}| price: ${nowPrice} | cur position: ${_Grid.length}\n`;
            //     console.log(logStr);
            //     fs.writeFileSync(config.LOG_FILE_PATH, logStr, {flag: 'a+'});
            //     util.notifyToPhone(logStr);
            // } else {
            //     // 撤销订单
            //     api.cancelOrder({
            //         symbol: config.COIN,
            //         orderId: orderRes['orderId']
            //     });
            // }
        }
    }

    isHandling = false;
}

function start(){
    // 生成listenKey并订阅市场消息
    api.createListenKey().then((data) => {
        console.log(`listenKey: ${data.listenKey}`);
        let ws = new WebSocket(`wss://fstream-auth.binance.com/ws/${config.COIN}@markPrice?listenKey=${data.listenKey}`);

        // 打开WebSocket连接后立刻发送一条消息:
        ws.on('open', function () {
            console.log(`[CLIENT] open()`);
            ws.send('Hello garlic chives!');
        });

        ws.on('close', function (m) {
            console.log(`[CLIENT] close(), ${m}`);
            ws.send('ws connection close!');
        });
        ws.on('error', function (m) {
            console.log(`[CLIENT] error(), ${m}`);
            ws.send('ws connection error!');
        });
	ws.on('ping', (e) => { //Defines callback for ping event
	    console.log(`${util.transTimeStampToDate(Date.now())}, get server ping `);
            ws.pong(); //send pong frame
	});
        // 响应收到的消息:
        ws.on('message', async function (message) {
            notifyCountDown++;
             ws.pong();
            // 定时提醒机器人正常
            if(notifyCountDown > config.NOTIFY_COUNTDOWN) {
                notifyCountDown = 0;
            }
            const msgData = JSON.parse(message.toString());
            if (msgData['error']) {
                console.log('error msg: ', msgData['error']);
                return;
            }
            if (isHandling) {
                console.log('bot is handling previous price...');
                return;
            }
            console.log(`[CLIENT] Received: ${message}`);
            const price = parseFloat(msgData.p);
            if (!isStart && ((direction === 1 && price <= startPrice) || (direction === -1 && price >= startPrice))) {
                isStart = true;
                console.log(`strategy start, cur price: ${price}`);
            }
            if (price) {
                await UpdateGrid(price, price, direction, msgData.E);
            }
        });
    });
}

// async function test(){
//     const orderRes = await queryOrderStatus('8389765524959610475', 3);
//     // const res = await api.cancelOrder({
//     //     symbol: config.COIN,
//     //     orderId: '8389765524959610475'
//     // });
//     // console.log(res);
//     console.log(orderRes);
// }

start();
// test();
