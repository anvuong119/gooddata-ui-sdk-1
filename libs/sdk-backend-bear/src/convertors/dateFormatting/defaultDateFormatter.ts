// (C) 2020 GoodData Corporation
import format from "date-fns/format";
import { UnexpectedError } from "@gooddata/sdk-backend-spi";

import { DateFormatter } from "./types";
import { dateFormats, DEFAULT_DATE_FORMAT } from "./dateValueParser";

/**
 * Creates a default date formatting function.
 * @public
 */
export const createDefaultDateFormatter = (dateFormat: string = DEFAULT_DATE_FORMAT): DateFormatter => {
    return (value: Date, targetDateFormat: string = dateFormat): string => {
        if (!dateFormats.includes(targetDateFormat)) {
            throw new UnexpectedError(
                `Unsupported date format "${targetDateFormat}". Supported date formats are ${dateFormats}`,
            );
        }
        return format(value, targetDateFormat);
    };
};
