const exec = require('child_process').exec;

async function execPing() {
    return new Promise((resolve, reject) => {
        exec('ping 10.0.2.2', (err, stdout, stderr) => {
            if (err) {
                reject(err);
            } else {
                resolve({
                    message: stdout
                });
            }
        });
    });
}

exports.handler = async (event) => {
    try {
        return await execPing();
    } catch (err) {
        throw err;
    }
};
