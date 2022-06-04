
const service = require('./service');

function ping(){
    return service.service({
        url: '/fapi/v1/ping',
        method: 'get'
    });
}

function createListenKey(){
    return service.service({
        url: '/fapi/v1/listenKey',
        method: 'post'
    });
}

function getuserinfo() {
    return service.service({
        url: '/account/userinfo',
        method: 'get'
    })
}
function login(username,password) {
    return service.service({
        url: '/account/login',
        method: 'post',
        data: {
            username,
            password
        }
    })
}

function getBalance(){
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
function getuserinfo_data() {
    getuserinfo().then(response => {
        const data = response.data
        console.log(data)
    }).catch(error => {
        console.log(error)
    })
}
function login_data(username,password) {
    login(username,password).then(response => {
        const data = response.data
        console.log(data)
    }).catch(error => {
        console.log(error)
    })
}

module.exports = {
    ping,
    createListenKey,
    getBalance,
}

