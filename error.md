deps
RUN npm ci
17s
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: '@prisma/streams-local@0.1.2',
npm warn EBADENGINE   required: { bun: '>=1.3.6', node: '>=22.0.0' },
npm warn EBADENGINE   current: { node: 'v20.20.2', npm: '10.8.2' }
npm warn EBADENGINE }
> 3ofspades@0.1.0 postinstall
> prisma generate
npm error code 1
npm error command sh -c prisma generate
Build Failed: build daemon returned an error < failed to solve: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1 >