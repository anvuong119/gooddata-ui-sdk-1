// (C) 2019-2020 GoodData Corporation
import * as React from "react";

import {
    IBucketItem,
    IBucketOfFun,
    IExtendedReferencePoint,
    IReferencePoint,
    IUiConfig,
    IVisConstruct,
    IVisProps,
    IVisualizationProperties,
    PluggableVisualizationErrorCodes,
} from "../../../interfaces/Visualization";
import { PluggableBaseChart } from "../baseChart/PluggableBaseChart";
import { ATTRIBUTE, BUCKETS, METRIC } from "../../../constants/bucket";
import { GEO_PUSHPIN_CHART_UICONFIG } from "../../../constants/uiConfig";
import {
    getAttributeItemsWithoutStacks,
    getItemsCount,
    getItemsFromBuckets,
    getMeasures,
    getPreferredBucketItems,
    isDateBucketItem,
    limitNumberOfMeasuresInBuckets,
    removeAllArithmeticMeasuresFromDerived,
    removeAllDerivedMeasures,
    removeShowOnSecondaryAxis,
} from "../../../utils/bucketHelper";
import { setGeoPushpinUiConfig } from "../../../utils/uiConfigHelpers/geoPushpinChartUiConfigHelper";
import { DASHBOARDS_ENVIRONMENT } from "../../../constants/properties";
import { GEOPUSHPIN_SUPPORTED_PROPERTIES } from "../../../constants/supportedProperties";
import GeoPushpinConfigurationPanel from "../../configurationPanels/GeoPushpinConfigurationPanel";
import { BucketNames, GoodDataSdkError, VisualizationTypes } from "@gooddata/sdk-ui";
import {
    attributeDisplayFormRef,
    bucketAttribute,
    idRef,
    IInsightDefinition,
    insightBucket,
    insightBuckets,
    insightFilters,
    insightHasDataDefined,
    ISortItem,
    isUriRef,
    newAttribute,
    newAttributeSort,
    newBucket,
    ObjRef,
    uriRef,
} from "@gooddata/sdk-model";
import { IExecutionFactory } from "@gooddata/sdk-backend-spi";
import { IGeoConfig, CoreGeoChart, getGeoChartDimensions } from "@gooddata/sdk-ui-geo";
import get = require("lodash/get");
import set = require("lodash/set");
import isEmpty = require("lodash/isEmpty");
import includes = require("lodash/includes");
import cloneDeep = require("lodash/cloneDeep");

const NUMBER_MEASURES_IN_BUCKETS_LIMIT = 2;

export class PluggableGeoPushpinChart extends PluggableBaseChart {
    private geoPushpinElement: string;

    constructor(props: IVisConstruct) {
        super(props);

        const { element, visualizationProperties } = props;
        this.type = VisualizationTypes.PUSHPIN;
        this.geoPushpinElement = element;
        this.initializeProperties(visualizationProperties);
    }

    protected checkBeforeRender(insight: IInsightDefinition): boolean {
        if (!insightHasDataDefined(insight)) {
            throw new GoodDataSdkError(PluggableVisualizationErrorCodes.EMPTY_AFM);
        }

        return true;
    }

    public getExtendedReferencePoint(referencePoint: IReferencePoint): Promise<IExtendedReferencePoint> {
        return super
            .getExtendedReferencePoint(referencePoint)
            .then((extendedReferencePoint: IExtendedReferencePoint) => {
                const newReferencePoint: IExtendedReferencePoint = setGeoPushpinUiConfig(
                    extendedReferencePoint,
                    this.intl,
                    this.type,
                );
                return this.updateSupportedProperties(newReferencePoint);
            });
    }

    public getUiConfig(): IUiConfig {
        return cloneDeep(GEO_PUSHPIN_CHART_UICONFIG);
    }

    protected getSupportedPropertiesList() {
        return GEOPUSHPIN_SUPPORTED_PROPERTIES;
    }

    protected configureBuckets(extendedReferencePoint: IExtendedReferencePoint): IExtendedReferencePoint {
        const newExtendedReferencePoint: IExtendedReferencePoint = this.sanitizeMeasures(
            extendedReferencePoint,
        );
        const buckets: IBucketOfFun[] = limitNumberOfMeasuresInBuckets(
            newExtendedReferencePoint.buckets,
            NUMBER_MEASURES_IN_BUCKETS_LIMIT,
        );
        const allMeasures: IBucketItem[] = getMeasures(buckets);
        const primaryMeasures: IBucketItem[] = getPreferredBucketItems(
            buckets,
            [BucketNames.MEASURES, BucketNames.SIZE],
            [METRIC],
        );
        const secondaryMeasures: IBucketItem[] = getPreferredBucketItems(
            buckets,
            [BucketNames.SECONDARY_MEASURES, BucketNames.COLOR],
            [METRIC],
        );
        const sizeMeasures: IBucketItem[] = (primaryMeasures.length > 0
            ? primaryMeasures
            : allMeasures.filter((measure: IBucketItem): boolean => !includes(secondaryMeasures, measure))
        ).slice(0, this.getPreferedBucketItemLimit(BucketNames.SIZE));

        const colorMeasures: IBucketItem[] = (secondaryMeasures.length > 0
            ? secondaryMeasures
            : allMeasures.filter((measure: IBucketItem): boolean => !includes(sizeMeasures, measure))
        ).slice(0, this.getPreferedBucketItemLimit(BucketNames.COLOR));

        set(newExtendedReferencePoint, BUCKETS, [
            {
                localIdentifier: BucketNames.LOCATION,
                items: this.getLocationItems(buckets),
            },
            {
                localIdentifier: BucketNames.SIZE,
                items: removeShowOnSecondaryAxis(sizeMeasures),
            },
            {
                localIdentifier: BucketNames.COLOR,
                items: removeShowOnSecondaryAxis(colorMeasures),
            },
            {
                localIdentifier: BucketNames.SEGMENT,
                items: this.getSegmentItems(buckets),
            },
        ]);
        return newExtendedReferencePoint;
    }

    protected renderConfigurationPanel(insight: IInsightDefinition) {
        const configPanelElement = document.querySelector(this.configPanelElement);

        // NOTE: using pushData directly; no handlePushData here as in other visualizations.
        if (configPanelElement) {
            this.renderFun(
                <GeoPushpinConfigurationPanel
                    locale={this.locale}
                    pushData={this.pushData}
                    properties={this.visualizationProperties}
                    references={this.references}
                    propertiesMeta={this.propertiesMeta}
                    insight={insight}
                    colors={this.colors}
                    type={this.type}
                    isError={this.isError}
                    isLoading={this.isLoading}
                    featureFlags={this.featureFlags}
                />,
                configPanelElement,
            );
        }
    }

    protected buildVisualizationConfig(
        options: IVisProps,
        supportedControls: IVisualizationProperties,
    ): IGeoConfig {
        const { config = {}, customVisualizationConfig = {} } = options;
        const { center, legend, viewport = {} } = supportedControls;
        const { colorMapping } = super.buildVisualizationConfig(options, supportedControls);
        const centerProp = center ? { center } : {};
        const legendProp = legend ? { legend } : {};
        const { isInEditMode, isExportMode } = config;
        const viewportProp = {
            viewport: {
                ...viewport,
                frozen: isInEditMode || isExportMode,
            },
        };
        const geoChartConfig = {
            ...config,
            ...centerProp,
            ...legendProp,
            ...viewportProp,
        };
        return {
            separators: config.separators,
            colorPalette: config.colorPalette,
            mapboxToken: config.mapboxToken,
            ...supportedControls,
            ...geoChartConfig,
            colorMapping,
            ...customVisualizationConfig,
        };
    }

    protected renderVisualization(
        options: IVisProps,
        insight: IInsightDefinition,
        executionFactory: IExecutionFactory,
    ) {
        const { dimensions = { height: undefined }, custom = {}, locale } = options;
        const { height } = dimensions;
        const { geoPushpinElement, intl } = this;

        // keep height undef for AD; causes indigo-visualizations to pick default 100%
        const resultingHeight = this.environment === DASHBOARDS_ENVIRONMENT ? height : undefined;
        const { drillableItems } = custom;
        const supportedControls: IVisualizationProperties = this.visualizationProperties.controls || {};
        const fullConfig = this.buildVisualizationConfig(options, supportedControls);

        const buckets = insightBuckets(insight);

        if (supportedControls && supportedControls?.tooltipText) {
            const tooltipText: string = supportedControls?.tooltipText;
            /*
             * The display form to use for tooltip text is provided in properties :( This is unfortunate; the chart
             * props could very well contain an extra prop for the tooltip bucket.
             *
             * Current guess is that this is because AD creates insight buckets; in order to create the tooltip
             * bucket, AD would have to actually show the tooltip bucket in the UI - which is not desired. Thus the
             * displayForm to add as bucket is passed in visualization properties.
             *
             * This workaround is highly unfortunate for two reasons:
             *
             * 1.  It leaks all the way to the API of geo chart: bucket geo does not have the tooltip bucket. Instead
             *     it duplicates then here logic in chart transform
             *
             * 2.  The executeVisualization endpoint is useless for GeoChart; cannot be used to render geo chart because
             *     the buckets stored in vis object are not complete. execVisualization takes buckets as is.
             */

            const locationBucket = insightBucket(insight, BucketNames.LOCATION);
            let ref: ObjRef = idRef(tooltipText, "displayForm");

            if (locationBucket) {
                const attribute = bucketAttribute(locationBucket);

                if (attribute && isUriRef(attributeDisplayFormRef(attribute))) {
                    ref = uriRef(tooltipText);
                }
            }

            buckets.push(
                newBucket(
                    BucketNames.TOOLTIP_TEXT,
                    newAttribute(ref, m => m.localId("tooltipText_df")),
                ),
            );
        }

        const execution = executionFactory
            .forBuckets(buckets, insightFilters(insight))
            .withDimensions(getGeoChartDimensions)
            .withSorting(...this.createSort(insight));

        const geoPushpinProps = {
            drillableItems,
            config: fullConfig as IGeoConfig,
            height: resultingHeight,
            intl,
            locale,
            execution,
            pushData: this.handlePushData,
            afterRender: this.afterRender,
            onDrill: this.onDrill,
            onError: this.onError,
            onExportReady: this.onExportReady,
            onLoadingChanged: this.onLoadingChanged,
            LoadingComponent: null as any,
            ErrorComponent: null as any,
        };

        this.renderFun(<CoreGeoChart {...geoPushpinProps} />, document.querySelector(geoPushpinElement));
    }

    private sanitizeMeasures(extendedReferencePoint: IExtendedReferencePoint): IExtendedReferencePoint {
        const newExtendedReferencePoint: IExtendedReferencePoint = removeAllArithmeticMeasuresFromDerived(
            extendedReferencePoint,
        );
        return removeAllDerivedMeasures(newExtendedReferencePoint);
    }

    private createSort(insight: IInsightDefinition): ISortItem[] {
        const bucket = insightBucket(insight, BucketNames.SEGMENT);
        const segmentAttribute = bucket && bucketAttribute(bucket);

        // sort by second attribute (1st: location, 2nd: segmentBy, 3rd: tooltipText)
        if (segmentAttribute) {
            return [newAttributeSort(segmentAttribute, "asc")];
        }

        return [];
    }

    private getSegmentItems(buckets: IBucketOfFun[]): IBucketItem[] {
        let segments = getPreferredBucketItems(
            buckets,
            [BucketNames.STACK, BucketNames.SEGMENT, BucketNames.COLUMNS],
            [ATTRIBUTE],
        );
        const nonSegmentAttributes = getAttributeItemsWithoutStacks(buckets);
        if (nonSegmentAttributes.length > 1 && isEmpty(segments)) {
            const locationItems = this.getLocationItems(buckets);
            segments = nonSegmentAttributes
                .filter((attribute: IBucketItem): boolean => !includes(locationItems, attribute))
                .filter((attribute: IBucketItem): boolean => !isDateBucketItem(attribute))
                .slice(0, 1);
        }
        return segments.slice(0, this.getPreferedBucketItemLimit(BucketNames.SEGMENT));
    }

    private getLocationItems(buckets: IBucketOfFun[]): IBucketItem[] {
        const locationItems: IBucketItem[] = getItemsFromBuckets(
            buckets,
            [BucketNames.ATTRIBUTE, BucketNames.VIEW, BucketNames.LOCATION, BucketNames.TREND],
            [ATTRIBUTE],
        ).filter((bucketItem: IBucketItem): boolean => Boolean(bucketItem.locationDisplayFormRef));

        return locationItems.slice(0, this.getPreferedBucketItemLimit(BucketNames.LOCATION));
    }

    private getPreferedBucketItemLimit(preferredBucket: string): number {
        const { buckets: bucketsUiConfig } = this.getUiConfig();
        return bucketsUiConfig[preferredBucket].itemsLimit;
    }

    private updateSupportedProperties(referencePoint: IExtendedReferencePoint): IExtendedReferencePoint {
        const buckets: IBucketOfFun[] = get(referencePoint, BUCKETS, []);
        const locationItem = this.getLocationItems(buckets)[0];
        if (!locationItem) {
            return referencePoint;
        }
        const referencePointConfigured = cloneDeep(referencePoint);
        const { dfRef } = locationItem;
        const visualizationProperties = this.visualizationProperties || {};
        const { controls = {} } = visualizationProperties;
        const hasSizeMesure = getItemsCount(buckets, BucketNames.SIZE) > 0;
        const hasColorMesure = getItemsCount(buckets, BucketNames.COLOR) > 0;
        const hasLocationAttribute = getItemsCount(buckets, BucketNames.LOCATION) > 0;
        const hasSegmentAttribute = getItemsCount(buckets, BucketNames.SEGMENT) > 0;
        const groupNearbyPoints =
            hasLocationAttribute && !hasColorMesure && !hasSizeMesure && !hasSegmentAttribute;

        // For tooltip text, displayFrom uri must be default displayFrom
        const tooltipText = isUriRef(dfRef) ? dfRef.uri : dfRef.identifier;

        set(referencePointConfigured, "properties", {
            controls: {
                points: {
                    groupNearbyPoints,
                },
                ...controls,
                tooltipText,
            },
        });

        if (this.references) {
            set(referencePointConfigured, "references", this.references);
        }
        return referencePointConfigured;
    }
}