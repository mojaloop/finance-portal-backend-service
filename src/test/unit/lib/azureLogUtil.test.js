const rewire = require('rewire');

const azureLogUtil = rewire('../../../lib/azureLogUtil');
const config = require('../../../config/config').azureLog;

describe('azureLogUtil:', () => {
    describe('Public functions:', () => {
        describe('getTransferMessageWithJWSSignature:', () => {
            const portalLib = azureLogUtil.__get__('portalLib');

            beforeEach(() => {
                azureLogUtil.__set__('getClientCredentialToken', jest.fn());
                azureLogUtil.__set__('getSearchQuery', jest.fn());
                portalLib.requests.buildUrl = jest.fn();
                portalLib.requests.post = jest.fn();
            });

            afterEach(() => {
                portalLib.requests.buildUrl.mockClear();
                portalLib.requests.post.mockClear();
            });

            describe('Failures:', () => {
                const fakeError = new Error('foo');

                it('throws an exception if `getClientCredentialToken` fails.', async () => {
                    azureLogUtil.__set__('getClientCredentialToken', jest.fn(() => { throw fakeError; }));

                    await expect(
                        azureLogUtil.getTransferMessageWithJWSSignature(config),
                    ).rejects.toThrow(fakeError);
                });
                it('throws an exception if `portalLib.requests.buildUrl` fails.', async () => {
                    portalLib
                        .requests
                        .buildUrl
                        .mockImplementation(jest.fn(() => { throw fakeError; }));

                    await expect(
                        azureLogUtil.getTransferMessageWithJWSSignature(config),
                    ).rejects.toThrow(fakeError);
                });
                it('throws an exception if `getSearchQuery` fails.', async () => {
                    azureLogUtil.__set__('getSearchQuery', jest.fn(() => { throw fakeError; }));

                    await expect(
                        azureLogUtil.getTransferMessageWithJWSSignature(config),
                    ).rejects.toThrow(fakeError);
                });
                it('throws an exception if `portalLib.requests.post` fails.', async () => {
                    portalLib
                        .requests
                        .post
                        .mockImplementation(jest.fn(() => { throw fakeError }));

                    await expect(
                        azureLogUtil.getTransferMessageWithJWSSignature(config),
                    ).rejects.toThrow(fakeError);
                });
            });

            describe('Success:', () => {
                it('returns `null` if there are no data in the response from Azure.', async () => {
                    portalLib
                        .requests
                        .post
                        .mockImplementation(jest.fn(() => (
                            {
                                tables: [{
                                    rows: [[]],
                                }],
                            }
                        )));

                    await expect(
                        azureLogUtil.getTransferMessageWithJWSSignature(config),
                    ).resolves.toEqual(null);
                });
                it('returns `null` if the cleaned message is empty.', async () => {
                    portalLib
                        .requests
                        .post
                        .mockImplementation(jest.fn(() => (
                            {
                                tables: [{
                                    rows: [['{foo: "not matching"}']],
                                }],
                            }
                        )));

                    await expect(
                        azureLogUtil.getTransferMessageWithJWSSignature(config),
                    ).resolves.toEqual(null);
                });
            });
        });
    });
});
