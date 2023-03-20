const utils = require("utils");
const oracledb = require("oracledb");

exports.handler = async (event, context) => {
  const user = utils.assertRequiredValue("user", event.user, "string");
  const password = utils.assertRequiredValue(
    "password",
    event.password,
    "string"
  );
  const connectString = utils.assertRequiredValue(
    "schema",
    event.connectString,
    "string"
  );
  const queryData = utils.assertRequiredValue(
    "queryData",
    event.queryData,
    "string"
  );

  if (event.formatObject) oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

  let connection;

  try {
    connection = await oracledb.getConnection({
      user,
      password,
      connectString,
    });

    const result = await connection.execute(queryData);

    console.log(JSON.stringify(result));

    oracledb.outFormat = oracledb.OUT_FORMAT_ARRAY;

    return result.rows;
  } catch (err) {
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        throw err;
      }
    }
  }
};
