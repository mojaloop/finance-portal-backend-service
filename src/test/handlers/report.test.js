const request = require("supertest");
const support = require("./_support.js");

let server;
let db;

beforeEach(async () => {
  db = support.createDb();
  server = support.createServer({ db });
});

afterEach(async () => {
  server.close();
});

jest.genMockFromModule("node-fetch");

describe("GET /report", () => {
  test("should respond 200 on file received", async () => {
    jest.mock("node-fetch", () =>
      jest.fn().mockImplementation(() => {
        const { PassThrough } = require("stream");
        const stream = new PassThrough();
        return Promise.resolve({
          status: 200,
          statusText: "OK",
          ok: false,
          body: stream,
        });
      })
    );

    const response = await request(server).get(
      `/report?name=settlement&type=xlsx&settlementId=4`
    );
    expect(response.status).toEqual(200);
  });

  test("should respond 204 on report not found", async () => {
    jest.mock("node-fetch", () =>
      jest.fn().mockImplementation(() =>
        Promise.resolve({
          status: 204,
          ok: false,
        })
      )
    );

    const response = await request(server).get(
      `/report?name=settlement&type=xlsx`
    );
    expect(response.status).toEqual(204);
  });

  test("should return 400 on query param didn't send", async () => {
    const response = await request(server).get(`/report`);
    expect(response.status).toEqual(400);
  });
});
