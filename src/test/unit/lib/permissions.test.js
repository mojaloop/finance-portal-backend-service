const fetch = require('node-fetch');

const { Response } = jest.requireActual('node-fetch');

jest.mock('node-fetch');

const permissions = require('../../../lib/permissions');

describe('permissions:', () => {
    describe('Public functions:', () => {
        describe('permit:', () => {
            let userInfoURL;
            let token;
            let requestMethod;
            let requestPath;
            let log;

            beforeAll(() => {
                userInfoURL = 'fake-url';
                token = 'fake-token';
                requestMethod = 'POST';
                requestPath = 'fake-netdebitcap';
                log = { warn: () => {}, info: () => {} };
            });

            describe('Failures:', () => {
                it('throws an exception if `fetch` fails.', async () => {
                    fetch.mockReturnValue(Promise.reject(new Error('fake error')));

                    await expect(
                        permissions.permit(userInfoURL, token, requestMethod, requestPath, log),
                    ).rejects.toThrow();
                });
            });

            describe('Success:', () => {
                describe('In case the target request path does not contain the string '
                    + '`netdebitcap`', () => {
                    it('returns `true`.', async () => {
                        const fakeRequestPath = 'fake-not-matching';

                        fetch.mockReturnValue(Promise.resolve(new Response(
                            JSON.stringify({
                                groups: 'foo,bar,baz',
                            }),
                        )));

                        const result = await permissions
                            .permit(userInfoURL, token, requestMethod, fakeRequestPath, log);

                        expect(result).toBe(true);
                    });
                });

                describe('In case the target request path contains the string `netdebitcap`:', () => {
                    describe('In case the target request method is not `POST`:', () => {
                        it('returns `true`.', async () => {
                            const fakeRequestMethod = 'GET';

                            fetch.mockReturnValue(Promise.resolve(new Response(
                                JSON.stringify({
                                    groups: 'foo,bar,baz',
                                }),
                            )));

                            const result = await permissions
                                .permit(userInfoURL, token, fakeRequestMethod, requestPath, log);

                            expect(result).toBe(true);
                        });
                    });

                    describe('In case the target request method is `POST`:', () => {
                        it('returns `false` if none of the allowed roles is included in the '
                            + '`usergroups` object of the response .', async () => {
                            fetch.mockReturnValue(Promise.resolve(new Response(
                                JSON.stringify({
                                    groups: 'foo,bar,baz',
                                }),
                            )));

                            const result = await permissions
                                .permit(userInfoURL, token, requestMethod, requestPath, log);

                            expect(result).toBe(false);
                        });

                        it('returns `true` if at least one of the allowed roles is included in the '
                            + '`usergroups` object of the response (`NDC_UPDATE`).', async () => {
                            fetch.mockReturnValue(Promise.resolve(new Response(
                                JSON.stringify({
                                    groups: 'foo,bar,baz,NDC_UPDATE',
                                }),
                            )));

                            const result = await permissions
                                .permit(userInfoURL, token, requestMethod, requestPath, log);

                            expect(result).toBe(true);
                        });

                        it('returns `true` if at least one of the allowed roles is included in the '
                            + '`usergroups` object of the response (`Ndc_update`).', async () => {
                            fetch.mockReturnValue(Promise.resolve(new Response(
                                JSON.stringify({
                                    groups: 'foo,bar,baz,Ndc_update',
                                }),
                            )));

                            const result = await permissions
                                .permit(userInfoURL, token, requestMethod, requestPath, log);

                            expect(result).toBe(true);
                        });

                        it('returns `true` if at least one of the allowed roles is included in the '
                            + '`usergroups` object of the response (`NdC_Update`).', async () => {
                            fetch.mockReturnValue(Promise.resolve(new Response(
                                JSON.stringify({
                                    groups: 'foo,bar,baz,NdC_Update',
                                }),
                            )));

                            const result = await permissions
                                .permit(userInfoURL, token, requestMethod, requestPath, log);

                            expect(result).toBe(true);
                        });

                        it('returns `true` if at least one of the allowed roles is included in the '
                            + '`usergroups` object of the response (`ndc_UPDATE`).', async () => {
                            fetch.mockReturnValue(Promise.resolve(new Response(
                                JSON.stringify({
                                    groups: 'foo,bar,baz,ndc_UPDATE',
                                }),
                            )));

                            const result = await permissions
                                .permit(userInfoURL, token, requestMethod, requestPath, log);

                            expect(result).toBe(true);
                        });
                    });
                });
            });
        });
    });
});
