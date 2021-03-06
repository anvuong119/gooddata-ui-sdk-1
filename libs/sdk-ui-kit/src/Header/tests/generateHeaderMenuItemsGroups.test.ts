// (C) 2021 GoodData Corporation
import { getAccountMenuFeatureFlagsMock, getWorkspacePermissionsMock } from "./mock";
import { generateHeaderMenuItemsGroups } from "../generateHeaderMenuItemsGroups";

describe("generateHeaderMenuItemsGroups", () => {
    it("should return dashboards and report items if hidePixelPerfectExperience is false", () => {
        const items = generateHeaderMenuItemsGroups(
            getAccountMenuFeatureFlagsMock(true, true, false, true, "enterprise"),
            getWorkspacePermissionsMock(true, true),
            true,
            "TestWorkspaceId",
            "TestDashboardId",
            "TestTabId",
            false,
        );
        expect(items).toEqual([
            [
                {
                    className: "s-menu-dashboards",
                    href: "/#s=/gdc/projects/TestWorkspaceId|projectDashboardPage|TestDashboardId|TestTabId",
                    key: "gs.header.dashboards",
                },
                {
                    className: "s-menu-reports",
                    href: "/#s=/gdc/projects/TestWorkspaceId|domainPage|all-reports",
                    key: "gs.header.reports",
                },
            ],
            [
                {
                    className: "s-menu-kpis",
                    href: "/dashboards/#/project/TestWorkspaceId",
                    key: "gs.header.kpis",
                },
                {
                    className: "s-menu-analyze",
                    href: "/analyze/#/TestWorkspaceId/reportId/edit",
                    key: "gs.header.analyze",
                },
                {
                    className: "s-menu-load",
                    href: "/data/#/projects/TestWorkspaceId/datasets",
                    key: "gs.header.load",
                },
            ],
            [
                {
                    className: "s-menu-manage",
                    href: "/#s=/gdc/projects/TestWorkspaceId|dataPage|",
                    key: "gs.header.manage",
                },
            ],
        ]);
    });

    it("should not return dashboards and report item if hidePixelPerfectExperience is true", () => {
        const items = generateHeaderMenuItemsGroups(
            getAccountMenuFeatureFlagsMock(true, true, true, false, "enterprise"),
            getWorkspacePermissionsMock(true, true),
            false,
            "TestWorkspaceId",
            "TestDashboardId",
            "TestTabId",
            false,
        );
        expect(items).toEqual([
            [
                {
                    className: "s-menu-load",
                    href: "/data/#/projects/TestWorkspaceId/datasets",
                    key: "gs.header.load",
                },
            ],
            [
                {
                    className: "s-menu-manage",
                    href: "/#s=/gdc/projects/TestWorkspaceId|dataPage|",
                    key: "gs.header.manage",
                },
            ],
        ]);
    });

    it("should return data item if platformEdition is free and hasNoDataSet is false", () => {
        const items = generateHeaderMenuItemsGroups(
            getAccountMenuFeatureFlagsMock(true, true, true, false, "free"),
            getWorkspacePermissionsMock(true, true),
            false,
            "TestWorkspaceId",
            "TestDashboardId",
            "TestTabId",
            false,
        );
        expect(items).toEqual([
            [
                {
                    className: "s-menu-data",
                    href: "/modeler/#/projects/TestWorkspaceId",
                    key: "gs.header.data",
                },
            ],
            [
                {
                    className: "s-menu-manage",
                    href: "/#s=/gdc/projects/TestWorkspaceId|dataPage|",
                    key: "gs.header.manage",
                },
            ],
        ]);
    });

    it("should return data item with datasource href if platformEdition is free and hasNoDataSet is true", () => {
        const items = generateHeaderMenuItemsGroups(
            getAccountMenuFeatureFlagsMock(true, true, true, false, "free"),
            getWorkspacePermissionsMock(true, true),
            true,
            "TestWorkspaceId",
            "TestDashboardId",
            "TestTabId",
            true,
        );
        expect(items).toEqual([
            [
                {
                    className: "s-menu-kpis",
                    href: "/dashboards/#/project/TestWorkspaceId",
                    key: "gs.header.kpis",
                },
                {
                    className: "s-menu-data",
                    href: "/admin/connect/#/projects/TestWorkspaceId/datasource",
                    key: "gs.header.data",
                },
            ],
            [
                {
                    className: "s-menu-manage",
                    href: "/#s=/gdc/projects/TestWorkspaceId|dataPage|",
                    key: "gs.header.manage",
                },
            ],
        ]);
    });

    it("should not return manage item if canManageMetric is false", () => {
        const items = generateHeaderMenuItemsGroups(
            getAccountMenuFeatureFlagsMock(true, true, true, false, "free"),
            getWorkspacePermissionsMock(true, false),
            false,
            "TestWorkspaceId",
            "TestDashboardId",
            "TestTabId",
            false,
        );
        expect(items).toEqual([
            [
                {
                    className: "s-menu-data",
                    href: "/modeler/#/projects/TestWorkspaceId",
                    key: "gs.header.data",
                },
            ],
        ]);
    });

    it("should not return data item if backendSupportsDataItem is false and platform edition is not free", () => {
        const items = generateHeaderMenuItemsGroups(
            getAccountMenuFeatureFlagsMock(true, true, true, false, "enterprise"),
            getWorkspacePermissionsMock(true, false),
            false,
            "TestWorkspaceId",
            "TestDashboardId",
            "TestTabId",
            false,
            false,
        );
        expect(items).toEqual([
            [
                {
                    className: "s-menu-load",
                    href: "/data/#/projects/TestWorkspaceId/datasets",
                    key: "gs.header.load",
                },
            ],
        ]);
    });
});
