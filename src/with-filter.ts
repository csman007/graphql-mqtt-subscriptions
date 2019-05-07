import { $$asyncIterator } from 'iterall';

/**
 * FilterFn function
 * @return boolean
 */
export type FilterFn = (rootValue?: any, args?: any, context?: any, info?: any) => boolean;
/**
 * ResolverFn function
 * @return AsyncIterator<any>
 */
export type ResolverFn = (rootValue?: any, args?: any, context?: any, info?: any) => AsyncIterator<any>;

/**
 * With filter function
 * @param asyncIteratorFn
 * @param filterFn
 */
export const withFilter = (asyncIteratorFn: () => AsyncIterator<any>, filterFn: FilterFn): Function => {
    return (rootValue: any, args: any, context: any, info: any): AsyncIterator<any> => {
        const asyncIterator = asyncIteratorFn();

        const getNextPromise = () => {
            return asyncIterator
                .next()
                .then(payload => Promise.all([
                    payload,
                    Promise.resolve(filterFn(payload.value, args, context, info)).catch(() => false)
                ]))
                .then(([payload, filterResult]) => {
                    if (filterResult === true) {
                        return payload;
                    }

                    // Skip the current value and wait for the next one
                    return getNextPromise();
                });
        };

        return {
            next(): any {
                return getNextPromise();
            },
            return(): Promise<IteratorResult<any>> {
                return asyncIterator.return();
            },
            throw(error): Promise<IteratorResult<any>> {
                return asyncIterator.throw(error);
            },
            [$$asyncIterator](): AsyncIterator<any> {
                return this;
            }
        };
    };
};
