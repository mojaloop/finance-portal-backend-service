const request = require('supertest');
const support = require('./_support.js');

jest.mock('node-fetch', () => () => require('./_support').mockAuthResponse);
jest.mock('../../lib/permissions', () => ({ permit: jest.fn(() => true) }));

let server;
let db;

beforeEach(async () => {
    db = support.createDb();
    server = support.createServer({ db });
});

afterEach(async () => {
    server.close();
});

describe('GET /userinfo', () => {
    test('should respond with username', async () => {
        const response = await request(server)
            .get('/userinfo')
            .set({ Cookie: 'mojaloop-portal-token=eyJ4NXQiOiJOVEF4Wm1NeE5ETXlaRGczTVRVMVpHTTBNekV6T0RKaFpXSTRORE5sWkRVMU9HRmtOakZpTVEiLCJraWQiOiJOVEF4Wm1NeE5ETXlaRGczTVRVMVpHTTBNekV6T0RKaFpXSTRORE5sWkRVMU9HRmtOakZpTVEiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJwb3J0YWxhZG1pbkBjYXJib24uc3VwZXIiLCJhdWQiOiJmdjB4WnhzdHpvMl9xVmNxTVJGcExJNDN4bThtWloiLCJuYmYiOjE2MzA5MTk3OTIsImF6cCI6ImZ2MHhaeHN0em8yX3FWY3FNUkZwTEk0M3htOG1aWiIsInNjb3BlIjoib3BlbmlkIiwiaXNzIjoiaHR0cHM6XC9cL2xvY2FsaG9zdDo5NDQzXC9vYXV0aDJcL3Rva2VuIiwiZ3JvdXBzIjpbIm5kY191cGRhdGUiLCJBcHBsaWNhdGlvblwvcG9ydGFsb2F1dGgiLCJJbnRlcm5hbFwvZXZlcnlvbmUiXSwiZXhwIjoxNjMwOTIzMzkyLCJpYXQiOjE2MzA5MTk3OTIsImp0aSI6IjE5NGIyOWYyLTA0ZjAtNGIxZC1hNzBjLTI2NDkwZTM0MjEzNSJ9.AtKtKYWiUEJgzYZU9HvCczAx1GO6HzMf1wi1PmraMvm-AbBoBthimsCaMnihEMdTg9aj_KTiv2X4snzsZmeI2bnSMtrrvzAmGkK2pKA0sVHFVoBxUNjtMwmO8H5JSSbIcgaelzke9l7CfNudWPIEjrXRjoIIZFPeyGSNgQu-YMgHSOj7SaZJC9S21oiImcNsyLyNkuvBKAqEjOhn9n_5WQRLT0Hgff92CPCkowhWx6tKkBgeAMJfTJXaT6bD_Xr5chqx39ET22efetasWeIEgdBq3A36uZjsMp1_JhN3vAwC60Shf2qb2njYt8o4aDWGzNsMXvoXahvxMbE6hKscIg' });
        expect(response.status).toEqual(200);
        expect(response.body).toEqual({ username: 'portaladmin' });
    });
});
