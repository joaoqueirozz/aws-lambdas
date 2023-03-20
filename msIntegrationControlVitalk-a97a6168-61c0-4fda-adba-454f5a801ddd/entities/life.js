async function getLive(models, document) {
  const data = await models.Life.query().where(
    "document_identification_primary",
    document
  );
  return data[0];
}

module.exports = { getLive };
