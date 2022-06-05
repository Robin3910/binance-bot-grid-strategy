const service = require('./service');

function ping() {
    return service.service({
        url: '/fapi/v1/ping',
        method: 'get'
    });
}

function createListenKey() {
    return service.service({
        url: '/fapi/v1/listenKey',
        method: 'post'
    });
}

function getBalance() {
    const ts = Date.now();
    return service.service({
        url: '/fapi/v2/balance',
        method: 'get',
        params: {
            timestamp: ts,
            signature: service.calcHash({timestamp: ts})
        }
    })
}

/**
 * 下单接口
 * @param params
 * symbol: ethusdt
 * side: BUY/SELL
 * type: MARKET
 * quantity: 0.003 需要将usdt转化成目标eth单位
 */
function placeOrder(params) {
    params.timestamp = Date.now();
    return service.service({
        url: '/fapi/v1/order',
        method: 'post',
        params: {
            ...params,
            signature: service.calcHash(params)
        }
    })
}

/**
 * 挂单后需要确认当前订单已经成交了，才能进行下一步操作
 * 查询三次还未成单后，撤销订单
 * @param params
 * symbol: ethusdt
 * orderId: 8389765524817242182
 * @returns {AxiosPromise}
 */
function queryOrders(params) {
    params.timestamp = Date.now();
    return service.service({
        url: '/fapi/v1/openOrders',
        method: 'get',
        params: {
            ...params,
            signature: service.calcHash(params)
        }
    })
}

/**
 * 撤销订单接口
 * @param params
 * symbol: ethusdt
 * orderId: 8389765524817242182
 * @returns {AxiosPromise}
 */
function cancelOrder(params) {
    params.timestamp = Date.now();
    return service.service({
        url: '/fapi/v1/order',
        method: 'delete',
        params: {
            ...params,
            signature: service.calcHash(params)
        }
    });
}

module.exports = {
    ping,
    createListenKey,
    getBalance,
    placeOrder,
    queryOrders,
    cancelOrder
}

