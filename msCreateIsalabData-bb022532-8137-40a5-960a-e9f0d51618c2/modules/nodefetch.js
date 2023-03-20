global.fetch = require("node-fetch");

async function post(payload) {

    const authorization = await auth();

    console.log(JSON.stringify(payload));

    return new Promise((resolve, reject) => {
        fetch(`https://agendas.isalab.com.br/api/v1/sami/pacientes`, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authorization.access_token}`
                },
            }).then(response => response.json())
            .then(result => resolve(result))
            .catch((err) => {
                reject(err)
            });
    })
}

async function auth() {
    return new Promise((resolve, reject) => {
        fetch(`https://agendas.isalab.com.br/api/login?email=thiago.araujo@samisaude.com&password=wteE3bQtTDTw5eL`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                },
            }).then(response => response.json())
            .then(result => resolve(result))
            .catch((err) => {
                reject(err)
            });
    })
}

module.exports = {
    post
}