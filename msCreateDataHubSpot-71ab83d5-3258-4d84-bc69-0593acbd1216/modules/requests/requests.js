const got = require("got");
module.exports = {
  /**
   * Create a register of company or contact
   * @param {Object} params required
   * @param {String} entity required
   * @param {Object} data required
   * @returns Object contained data response
   */
  async storeData(params, entity, data) {
    console.log(JSON.stringify(data));
    console.log(` (storeData) POST ${params.url}/${entity}`);
    try {
      const response = await got.post(
        `${params.url}/${entity}`,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${params.token}`
          },
          json: data,
          responseType: "json",
        }
      );
      console.log(` (response) ${JSON.stringify(response.body)}`);
      return response.body;
    } catch (error) {
      console.log(JSON.stringify(error.message));
      console.log(JSON.stringify(error.response.data));
      console.log(JSON.stringify(error.response));
      throw error;
    }
  },
  /**
   * Associate an contact a company
   * @param {Object} params required
   * @param {Number} company_id required
   * @param {Number} contact_id required
   * @returns Object contained data inserted in hubspot
   */
  async assosiateContact(params, company_id, contact_id) {
    try {
      console.log(
        ` (associateContact) PUT ${params.url}/contacts/${String(
          contact_id
        )}/associations/company/${String(company_id)}/contact_to_company`
      );
      const response = await got.put(
        `${params.url}/contacts/${String(
          contact_id
        )}/associations/company/${String(company_id)}/contact_to_company`,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${params.token}`
          },
          responseType: "json",
        }
      );
      console.log(` (response) ${JSON.stringify(response.body)}`);
      return response.body;
    } catch (error) {
      // console.log(JSON.stringify(error));
      console.log(JSON.stringify(error.message));
      console.log(JSON.stringify(error.body));
      console.log(JSON.stringify(error.response));
      throw error;
    }
  },
  /**
   * Update a entity in hubspot
   * @param {Object} data required
   * @param {Object} params required
   * @returns Object contained data inserted in hubspot
   */
  async updateData(data, params) {
    console.log(JSON.stringify(data));
    try {
      const { contact_id, company_id } = data;
      delete data.contact_id;
      delete data.company_id;

      console.log(
        ` (updateData - contact) PATCH ${params.url}/contact/${contact_id}`
      );

      const response = await got.patch(
        `${params.url}/contact/${contact_id}`,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${params.token}`
          },
          json: { properties: data },
          responseType: "json",
        }
      );

      console.log(
        ` (updateData - company) PATCH ${params.url}/company/${company_id}`
      );

      await got.patch(`${params.url}/company/${company_id}`, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${params.token}`
        },
        json: {
          properties: { hs_lead_status: data["hs_lead_status"] },
        },
        responseType: "json",
      });
      console.log(` (response) ${JSON.stringify(response.body)}`);
      return response.body;
    } catch (error) {
      // console.log(JSON.stringify(error));
      console.log(JSON.stringify(error.message));
      console.log(JSON.stringify(error.body));
      console.log(JSON.stringify(error.response));
      throw error;
    }
  },
  /**
   * Get a contact if exist
   * @param {Object} params required
   * @param {String} contact required
   * @returns Object with contact
   */
  async getContact(params, contact) {
    console.log(
      ` (getContact) POST ${params.url}/contact/search`
    );

    try {
      const response = await got.post(
        `${params.url}/contact/search`,
        {
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "Authorization": `Bearer ${params.token}`,
          },
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  {
                    value: contact,
                    propertyName: "email",
                    operator: "EQ",
                  },
                ],
              },
            ],
          }),
          responseType: "json",
        }
      );
      console.log(` (response) ${JSON.stringify(response.body)}`);
      return response.body;
    } catch (error) {
      // console.log(JSON.stringify(error));
      console.log(JSON.stringify(error.message));
      console.log(JSON.stringify(error.body));
      console.log(JSON.stringify(error.response));
      throw error;
    }
  },
};
