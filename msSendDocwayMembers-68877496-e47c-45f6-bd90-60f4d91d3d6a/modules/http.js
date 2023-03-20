const got = require("got");
const FormData = require("form-data");
const util = require("util");
const utils = require("utils");
const awsSSM = require("aws-sdk/clients/ssm");
const ssm = new awsSSM();

let docwayConfig;

async function init(env) {
  docwayConfig = docwayConfig || (await utils.getSsmParam(ssm, "docway"))[env];
}

async function getAccessToken() {
  const { authorization } = docwayConfig;

  // create form-data
  const body = new FormData();
  body.append("grant_type", authorization.grantType);
  body.append("scope", authorization.scope);

  // request access token
  const res = await got.post(authorization.url, {
    body: body,
    headers: {
      Authorization: `Basic ${authorization.token}`,
    },
    responseType: "json",
  });

  return res.body.access_token;
}

async function sendDatabase(token, file) {
  const { importDatabase } = docwayConfig;

  // create form-data
  const body = new FormData();

  // fill form-data
  for (const key in importDatabase["form-data"]) {
    if (Object.hasOwnProperty.call(importDatabase["form-data"], key)) {
      const element = importDatabase["form-data"][key];
      body.append(key, element);
    }
  }

  // append file
  body.append("DataBaseFile", file);

  console.log(util.inspect({ formData: body._streams }, true, Infinity, false));

  // send database
  const res = await got.post(importDatabase.url, {
    body: body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseType: "json",
  });

  return {
    statusCode: res.statusCode,
    body: res.body,
  };
}

async function checkImport(token) {
  const { verifyImport } = docwayConfig;

  // send database
  const res = await got.get(verifyImport.url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseType: "json",
  });

  return res.body.result[0];
}

async function getImportDetails(token, importId) {
  const { verifyImportDetails } = docwayConfig;

  // send database
  const res = await got.get(
    verifyImportDetails.url.replace("{importId}", importId),
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: "json",
    }
  );

  return res.body;
}

module.exports = {
  init,
  getAccessToken,
  sendDatabase,
  checkImport,
  getImportDetails,
};
