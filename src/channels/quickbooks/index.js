const quickbooksApiClient = require("./apiClient/quickbooksApiClient");
const {
  Company,
  Customer,
  Vendor,
  Account,
  Invoice,
  InvoiceSaleLineItem,
  SaleLineItem,
  EntityMapping,
  InvoiceLineItem,
  Purchase,
} = require("../../db/models/");

require("dotenv").config();

class QuickBooksSync {
  constructor(config, companyId, integrationId, userid) {
    this.apiClient = new quickbooksApiClient(config);
    this.config = config;
    this.companyId = companyId;
    this.integrationId = integrationId;
    this.userid = userid;
  }

  async sync() {
    console.log("syncing...");

    try {
      // await this.syncCompanyInfo();
      await this.syncCustomers();
      await this.syncVendors();
      // await this.syncAccounts();
      // await this.syncInvoices();
    } catch (error) {
      console.error("Error importing data from QuickBooks:", error);
      throw error;
    }
  }

  async syncCustomers() {
    console.log("Starting customer synchronization...");
    let page = 1;
    let pageSize = 10;
    let hasMore = true;

    const totalCount = await this.apiClient.count("Customer");

    while (hasMore) {
      const { customers } = await this.apiClient.customers.list(page, pageSize);

      for (const customerData of customers) {
        const entityMapping = await this.getOrCreateEntityMapping(
          "Customer",
          customerData.Id,
        );
        if (entityMapping.local_id) {
          const customerRecord = await Customer.findByPk(
            entityMapping.local_id,
          );
          console.log(
            `Customer with ID ${customerData.Id} already exists. Updating...`,
          );
          await customerRecord.update({
            ...this.transformCustomerData(customerData),
            // companyId: this.companyId,
          });
        } else {
          console.log(
            `Customer with ID ${customerData.Id} does not exist. Creating...`,
          );
          const customerRecord = await Customer.create({
            ...this.transformCustomerData(customerData),
            // companyId: this.companyId,
          });
          await this.createEntityMapping(
            "Customer",
            customerData.Id,
            customerRecord.id,
          );
        }
      }

      console.log(`Processed ${customers.length} customers from page ${page}`);
      hasMore = page * pageSize < totalCount;
      page++;
    }
    console.log("Customer synchronization completed successfully.");
  }

  async syncVendors() {
    console.log("Starting vendor synchronization...");

    let page = 1;
    let pageSize = 10;
    let hasMore = true;

    const totalCount = await this.apiClient.count("Vendor");

    while (hasMore) {
      const { vendors } = await this.apiClient.vendors.list(page, pageSize);

      for (const vendorData of vendors) {
        const entityMapping = await this.getOrCreateEntityMapping(
          "Vendor",
          vendorData.Id,
        );

        if (entityMapping.local_id) {
          const vendorRecord = await Vendor.findByPk(entityMapping.local_id);
          console.log(
            `Vendor with ID ${vendorData.Id} already exists. Updating...`,
          );
          await vendorRecord.update(
            {
              ...this.transformVendorData(vendorData),
            },
            {
              where: {
                id: entityMapping.local_id,
              },
            },
          );
        } else {
          console.log(
            `Vendor with ID ${vendorData.Id} does not exist. Creating...`,
          );
          const vendorRecord = await Vendor.create({
            ...this.transformVendorData(vendorData),
            companyId: this.companyId,
          });
          await this.createEntityMapping(
            "Vendor",
            vendorData.Id,
            vendorRecord.id,
          );
        }
      }

      console.log(`Processed ${vendors.length} vendors from page ${page}`);
      hasMore = page * pageSize < totalCount;
      page++;
    }

    console.log("Vendor synchronization completed successfully.");
  }

  async getOrCreateEntityMapping(entityType, externalId) {
    const entityMapping = await EntityMapping.findOne({
      where: {
        entity_type: entityType,
        external_id: externalId,
        CompanyId: this.companyId,
        IntegrationId: this.integrationId,
        UserId: this.userid,
      },
    });

    if (entityMapping) {
      return entityMapping;
    } else {
      return { local_id: null };
    }
  }

  async createEntityMapping(entityType, externalId, localId) {
    await EntityMapping.create({
      entity_type: entityType,
      external_id: externalId,
      CompanyId: this.companyId,
      IntegrationId: this.integrationId,
      local_id: localId,
      sync_status: "Synced",
      UserId: this.userid,
    });
  }

  transformCustomerData(customer) {
    return {
      name: customer.DisplayName,
      email: customer.PrimaryEmailAddr?.Address,
      companyName: customer.CompanyName,
      active: customer.Active,
      balance: customer.Balance,
      metaData: customer.MetaData,
      billing_address: customer.BillAddr
        ? {
            Line1: customer.BillAddr.Line1,
            City: customer.BillAddr.City,
            State: customer.BillAddr.CountrySubDivisionCode,
            ZipCode: customer.BillAddr.PostalCode,
            Country: customer.BillAddr.Country,
          }
        : null,
      shipping_address: customer.ShipAddr
        ? {
            Line1: customer.ShipAddr.Line1,
            City: customer.ShipAddr.City,
            State: customer.ShipAddr.CountrySubDivisionCode,
            ZipCode: customer.ShipAddr.PostalCode,
            Country: customer.ShipAddr.Country,
          }
        : null,
      phone: customer.PrimaryPhone?.FreeFormNumber,
      CompanyId: this.companyId,
      UserId: this.userid,
    };
  }

  transformVendorData(vendor) {
    return {
      name: vendor.DisplayName,
      email: vendor.PrimaryEmailAddr?.Address,
      address: {
        Line1: vendor.BillAddr?.Line1,
        City: vendor.BillAddr?.City,
        State: vendor.BillAddr?.CountrySubDivisionCode,
        ZipCode: vendor.BillAddr?.PostalCode,
        Country: vendor.BillAddr?.Country,
      },
      phone: vendor.PrimaryPhone?.FreeFormNumber,
      active: vendor.Active,
      metaData: vendor.MetaData,
      CompanyId: this.companyId,
      UserId: this.userid,
    };
  }
}

module.exports = QuickBooksSync;
