import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Box from "../models/boxModel.js";
import User from "../models/User.js";
import ClientBatch from "../models/clientBatchModel.js";
import { createClientBatch, listClientBatches } from "../controllers/clientBatchController.js";
import { createChallan, editChallan, cancelChallan, downloadChallanPdf } from "../controllers/challanController.js";
import { getBoxAvailabilityByCode, updateBox } from "../controllers/boxController.js";

test("bill 805 quantities persist through batch, dispatch, PDF, edit and cancellation", async () => {
  const mongo = await MongoMemoryServer.create();
  let server;
  try {
    await mongoose.connect(mongo.getUri(), { dbName: "dispatch_regression" });
    const user = await User.create({ name: "Test Admin", email: "test@example.invalid", password: "test", role: "admin" });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = user; next(); });
    app.post("/batches", createClientBatch);
    app.get("/batches", listClientBatches);
    app.post("/challans", createChallan);
    app.put("/challans/:id", editChallan);
    app.post("/challans/:id/cancel", cancelChallan);
    app.get("/challans/:id/pdf", downloadChallanPdf);
    app.get("/availability/:code", getBoxAvailabilityByCode);
    app.put("/boxes/:id", updateBox);
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (path, body, method = "POST") => {
      const response = await fetch(base + path, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json();
      assert.ok(response.ok, JSON.stringify(result));
      return result;
    };
    const before = { pink: 60, "light blue": 410, "light green": 0, purple: 670,
      yellow: 160, white: 0, red: 500, "dark green": 200, "white uv": 340, magenta: 240 };
    const box = await Box.create({ title: "Single peda box", code: "V01", price: 6,
      colours: Object.keys(before), quantityByColor: before });
    const colorLines = Object.entries({ "dark green": 200, "light blue": 100, pink: 60,
      purple: 550, red: 140, yellow: 150 }).map(([color, quantity]) => ({ color, quantity }));
    const draft = { label: "Bill 805 regression", inventory_mode: "dispatch", challanTaxType: "NON_GST",
      challanDate: "2026-10-10", manualItems: [{ boxId: String(box._id), quantity: 1200, rate: 6, colorLines }] };
    await request("/batches", draft);
    const batches = await (await fetch(base + "/batches")).json();
    assert.equal(batches[0].inventory_mode, "dispatch");
    assert.deepEqual(batches[0].manualItems[0].colorLines, colorLines);
    const challan = await request("/challans", batches[0]);
    const expected = { ...before, pink: 0, "dark green": 0, "light blue": 310, purple: 120, red: 360, yellow: 10 };
    const readStock = async () => (await Box.findById(box._id).lean()).quantityByColor;
    assert.deepEqual(await readStock(), expected);
    assert.equal(Object.values(await readStock()).reduce((sum, qty) => sum + qty, 0), 1380);
    console.log("VERIFIED: persisted V01 stock 2580 -> 1380; pink 60 -> 0; dark green 200 -> 0");

    const staleSave = await fetch(base + `/boxes/${box._id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Single peda box", quantityByColor: before,
        expectedUpdatedAt: box.updatedAt.toISOString() }),
    });
    assert.equal(staleSave.status, 409, "An outdated product form must not restore dispatched stock");
    assert.deepEqual(await readStock(), expected);
    const currentBox = await Box.findById(box._id);
    await request(`/boxes/${box._id}`, { quantityByColor: expected,
      expectedUpdatedAt: currentBox.updatedAt.toISOString() }, "PUT");
    assert.deepEqual(await readStock(), expected);
    const unversionedSave = await fetch(base + `/boxes/${box._id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantityByColor: before }),
    });
    assert.equal(unversionedSave.status, 428);
    assert.deepEqual(await readStock(), expected);

    const pdfResponse = await fetch(base + `/challans/${challan._id}/pdf`);
    assert.equal(pdfResponse.status, 200);
    assert.match(pdfResponse.headers.get("content-type"), /application\/pdf/);
    const pdf = Buffer.from(await pdfResponse.arrayBuffer());
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pdf.length > 1000);
    assert.deepEqual(await readStock(), expected);

    await request(`/challans/${challan._id}`, { inventoryMode: "dispatch" }, "PUT");
    assert.deepEqual(await readStock(), expected);
    await request(`/challans/${challan._id}/cancel`, { reason: "Integration test" });
    assert.deepEqual(await readStock(), before);
    const repeatedCancel = await fetch(base + `/challans/${challan._id}/cancel`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Repeat" }),
    });
    assert.equal(repeatedCancel.status, 400);
    assert.deepEqual(await readStock(), before);

    await request("/challans", { ...draft, inventory_mode: "record_only" });
    assert.deepEqual(await readStock(), before);

    const duplicate = await Box.create({ title: "Another V01", code: "V01", price: 6,
      colours: ["pink"], quantityByColor: { pink: 999 } });
    const ambiguous = await fetch(base + "/availability/V01");
    assert.equal(ambiguous.status, 409);
    const availability = await (await fetch(base + `/availability/V01?boxId=${box._id}`)).json();
    assert.equal(availability.box_id, String(box._id));
    assert.equal(availability.totalQuantity, 2580);
    assert.equal((await Box.findById(duplicate._id)).quantityByColor.get("pink"), 999);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
});
