function getBrazilTime() {
    const strDate = (new Date()).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    return new Date(strDate);
}

function getCustomTime(strDate) {
    return new Date(strDate);
}

function compareDates(date1, date2) {
    if (date1.getTime() < date2.getTime()) {
        return -1;
    } else if (date1.getTime() > date2.getTime()) {
        return 1;
    } else {
        return 0;
    }
}

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, ms);
    })
}

module.exports = {
    getBrazilTime,
    getCustomTime,
    compareDates,
    sleep
}