// (C) 2020 GoodData Corporation

import { dummyBackend } from "@gooddata/sdk-backend-mockingbird";
import { IAnalyticalBackend } from "@gooddata/sdk-backend-spi";
import { IExecutionDefinition } from "@gooddata/sdk-model";
import { NormalizationState, withEventing, withNormalization } from "@gooddata/sdk-backend-base";

export type DataViewRequests = {
    allData?: boolean;
    windows?: RequestedWindow[];
};

export type RequestedWindow = {
    offset: number[];
    size: number[];
};

/**
 * Recorded chart interactions
 */
export type ChartInteractions = {
    /**
     * The execution that was actually triggered
     */
    triggeredExecution?: IExecutionDefinition;

    /**
     * If execution normalization is in effect, then this describes what the
     * normalization process did.
     */
    normalizationState?: NormalizationState;

    /**
     * What data views were requested during rendering
     */
    dataViewRequests: DataViewRequests;

    effectiveProps?: any;
};

/**
 * Creates an instance of backend which captures interactions with the execution service. The captured
 * interactions are resolved as soon as all data or data window is requested on the execution result.
 */
export function backendWithCapturing(
    normalize: boolean = false,
): [IAnalyticalBackend, Promise<ChartInteractions>] {
    const interactions: ChartInteractions = {
        dataViewRequests: {},
    };

    let dataRequestResolver: (interactions: ChartInteractions) => void;
    const capturedInteractions = new Promise<ChartInteractions>(resolve => {
        dataRequestResolver = resolve;
    });

    let backend = withEventing(dummyBackend({ hostname: "test", raiseNoDataExceptions: true }), {
        beforeExecute: def => {
            interactions.triggeredExecution = def;
        },
        failedResultReadAll: _ => {
            interactions.dataViewRequests.allData = true;

            dataRequestResolver(interactions);
        },
        failedResultReadWindow: (offset: number[], size: number[]) => {
            if (!interactions.dataViewRequests.windows) {
                interactions.dataViewRequests.windows = [];
            }

            interactions.dataViewRequests.windows.push({ offset, size });

            dataRequestResolver(interactions);
        },
    });

    if (normalize) {
        backend = withNormalization(backend, {
            normalizationStatus: (state: NormalizationState) => {
                interactions.normalizationState = state;
            },
        });
    }

    return [backend, capturedInteractions];
}
