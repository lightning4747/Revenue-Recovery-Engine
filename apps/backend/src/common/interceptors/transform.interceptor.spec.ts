import { TransformInterceptor } from './transform.interceptor';
import { of } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should transform response into standard envelope', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as any;

    const mockCallHandler = {
      handle: () => of({ status: 'ok' }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((res) => {
      expect(res).toEqual(
        expect.objectContaining({
          success: true,
          statusCode: 200,
          data: { status: 'ok' },
        }),
      );
      done();
    });
  });
});
