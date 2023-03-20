const awsS3 = require("aws-sdk/clients/s3");
const s3 = new awsS3();

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
  recopSaveRaw,
};
