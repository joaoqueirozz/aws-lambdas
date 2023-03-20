const awsS3 = require("aws-sdk/clients/s3");
const s3 = new awsS3();

async function getFile(params) {
  return await s3
    .getObject({
      Bucket: params.bucket,
      Key: params.key,
    })
    .promise();
}

async function getJsonData(params) {
  const data = await s3
    .getObject({
      Bucket: params.bucket,
      Key: params.key,
    })
    .promise();

  return JSON.parse(data.Body.toString());
}

async function putFile(params) {
  // faz o upload
  await s3
    .upload({
      Bucket: params.bucket,
      Key: params.key,
      Body: params.body,
    })
    .promise();
}

// Armazena no S3 (Rotina 0 do Recop)
async function recopSaveRaw(pacote, path) {
  try {
    await s3
      .putObject({
        Bucket: "sami-data-interoperabilidade",
        Key: path,
        ContentType: "application/json",
        Body: JSON.stringify(pacote),
      })
      .promise();

    console.log(
      `>>> Armazenado no s3://sami-data-interoperabilidade/${path} <<<`
    );
  } catch (err) {
    throw err;
  }
}

module.exports = {
  getFile,
  getJsonData,
  putFile,
  recopSaveRaw,
};
