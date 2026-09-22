/*
 * Copyright 2025 The Kubernetes Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import './themes';
import { registerRoute, registerSidebarEntry } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { EVOCLOUD_ICON_MONO } from './icons/evocloud';
import AppEndpoints from './pages/AppEndpoints';
import CrdSchemaDetail from './pages/CrdSchemaDetail';
import CrdSchemas from './pages/CrdSchemas';
import { CRD_SCHEMA_ROUTE, CRD_SCHEMAS_ROUTE } from './pages/crdSchemas/routes';
import Overview from './pages/Overview';
import VelaAddons from './pages/VelaAddons';
import VelaApplications from './pages/VelaApplications';
// import { EvoCloudAppLogo } from './ui/AppLogo';

// Navbar wordmark — DISABLED, and it should stay that way unless the logo is
// meant to be this plugin's job.
//
// Headlamp holds exactly one logo slot (`state.theme.logo`). Registering here
// does not add a logo beside anyone else's, it takes the slot: Headlamp's own
// OriginalAppLogo stops rendering entirely, and a second plugin that registers
// a logo either overwrites this or is overwritten by it, decided by nothing
// more than plugin load order. That is what was breaking the standalone logo
// plugin.
//
// It also has nothing left to do. The wordmark only read "EvoCloud" while an
// EvoCloud theme was selected, and those registrations are commented out in
// themes.ts — so this could only ever render the word "Headlamp" over
// Headlamp's own mark, at the cost of the slot.
//
// registerAppLogo(EvoCloudAppLogo);

// 1. Top-Level EvoCloud Parent Sidebar Item
registerSidebarEntry({
  parent: null,
  name: 'evocloud',
  label: 'EvoCloud',
  icon: EVOCLOUD_ICON_MONO,
  url: '/evocloud/overview',
});

// 2. Child Item: Overview
registerSidebarEntry({
  parent: 'evocloud',
  name: 'evocloud-overview',
  label: 'Overview',
  url: '/evocloud/overview',
});

registerRoute({
  path: '/evocloud/overview',
  sidebar: 'evocloud-overview',
  name: 'evocloud-overview',
  exact: true,
  component: () => <Overview />,
});

// 3. Child Item: App Endpoints — the published application catalog
registerSidebarEntry({
  parent: 'evocloud',
  name: 'evocloud-app-endpoints',
  label: 'App Endpoints',
  url: '/evocloud/app-endpoints',
});

registerRoute({
  path: '/evocloud/app-endpoints',
  sidebar: 'evocloud-app-endpoints',
  name: 'evocloud-app-endpoints',
  exact: true,
  component: () => <AppEndpoints />,
});

// 4. Child Group: KubeVela — one heading over the pages that read it
//
// A group rather than two more siblings of Overview. Sidebar entries nest to
// any depth: `SidebarItem` renders its children recursively and indents each
// level, and a group expands when anything inside it is selected, so the pages
// below are reachable in one click from anywhere in the section.
//
// It also settles a naming problem. Flat beside "App Endpoints", a page called
// "Applications" would be two entries whose labels do not distinguish them —
// one is the catalog of what is published, the other the delivery model behind
// it. Under a KubeVela heading the shorter label is already unambiguous, so the
// heading carries the qualifier instead of every child repeating it.
//
// The group points at Applications: a heading has to lead somewhere when it is
// clicked, and Headlamp otherwise falls back to whichever child happens to be
// registered first.
registerSidebarEntry({
  parent: 'evocloud',
  name: 'evocloud-kubevela',
  label: 'KubeVela',
  url: '/evocloud/kubevela/applications',
});

// 4a. Applications — what has been delivered, and how it is configured
registerSidebarEntry({
  parent: 'evocloud-kubevela',
  name: 'evocloud-vela-applications',
  label: 'Applications',
  url: '/evocloud/kubevela/applications',
});

registerRoute({
  path: '/evocloud/kubevela/applications',
  sidebar: 'evocloud-vela-applications',
  name: 'evocloud-vela-applications',
  exact: true,
  component: () => <VelaApplications />,
});

// 4b. Addons — the catalog KubeVela installs capabilities from
registerSidebarEntry({
  parent: 'evocloud-kubevela',
  name: 'evocloud-vela-addons',
  label: 'Addons',
  url: '/evocloud/kubevela/addons',
});

registerRoute({
  path: '/evocloud/kubevela/addons',
  sidebar: 'evocloud-vela-addons',
  name: 'evocloud-vela-addons',
  exact: true,
  component: () => <VelaAddons />,
});

// 5. Child Item: CRD Schemas — the contracts behind every custom resource
registerSidebarEntry({
  parent: 'evocloud',
  name: CRD_SCHEMAS_ROUTE,
  label: 'CRD Schemas',
  url: '/evocloud/crd-schemas',
});

registerRoute({
  path: '/evocloud/crd-schemas',
  sidebar: CRD_SCHEMAS_ROUTE,
  name: CRD_SCHEMAS_ROUTE,
  exact: true,
  component: () => <CrdSchemas />,
});

// The schema of one version. Not a sidebar entry of its own — it keeps the
// index's entry lit, so the section a detail page belongs to stays marked while
// you are inside it.
registerRoute({
  path: '/evocloud/crd-schemas/:name/:version',
  sidebar: CRD_SCHEMAS_ROUTE,
  name: CRD_SCHEMA_ROUTE,
  exact: true,
  component: () => <CrdSchemaDetail />,
});
