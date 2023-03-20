global.fetch = require("node-fetch");

const { authenticate } = require("./cognito");

async function post(env, resource, payload) {
  const token = await authenticate();

  return new Promise((resolve, reject) => {
    fetch(
      `https://c3pdq0samk.execute-api.us-east-1.amazonaws.com/${env}/${resource}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      }
    )
      .then((response) => response.json())
      .then((result) => {
        console.log("Criando o registro...");
        resolve(result);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

async function update(env, resource, payload, id) {
  const token = await authenticate();

  return new Promise((resolve, reject) => {
    fetch(
      `https://c3pdq0samk.execute-api.us-east-1.amazonaws.com/${env}/${resource}/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      }
    )
      .then((response) => response.json())
      .then((result) => {
        console.log("Atualizando o registro...");
        resolve(result);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

async function get(env, resource, id) {
  const token = await authenticate();

  return new Promise((resolve, reject) => {
    fetch(
      `https://c3pdq0samk.execute-api.us-east-1.amazonaws.com/${env}/${resource}/${id}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      }
    )
      .then((response) => response.json())
      .then((result) => resolve(result))
      .catch((err) => {
        reject(err);
      });
  });
}

async function remove(env, resource, id) {
  const token = await authenticate();

  return new Promise((resolve, reject) => {
    fetch(
      `https://c3pdq0samk.execute-api.us-east-1.amazonaws.com/${env}/${resource}/${id}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      }
    )
      .then((response) => response.json())
      .then((result) => resolve(result))
      .catch((err) => {
        reject(err);
      });
  });
}

async function getByIdentifier(env, resource, key, value) {
  const token = await authenticate();

  return new Promise((resolve, reject) => {
    fetch(
      `https://c3pdq0samk.execute-api.us-east-1.amazonaws.com/${env}/${resource}?key=${key}&value=${value}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      }
    )
      .then((response) => response.json())
      .then((result) => resolve(result))
      .catch((err) => {
        reject(err);
      });
  });
}

module.exports = {
  post,
  update,
  get,
  remove,
  getByIdentifier,
};
