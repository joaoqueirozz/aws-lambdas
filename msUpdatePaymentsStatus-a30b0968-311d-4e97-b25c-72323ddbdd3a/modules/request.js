const got = require("got");

module.exports = {
  async updateData(data, params) {
    const { contact_id } = data;
    delete data.contact_id;
    // console.log(`${params.url}/contact/${contact_id}?${params.apiKey}`);
    console.log(JSON.stringify({ properties: data }));
    const response = await got.patch(
      `${params.url}/contact/${contact_id}?${params.apiKey}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        json: { properties: data },
        responseType: "json",
      }
    );
    console.log(JSON.stringify(response.body));
    return response;
  },
};
