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
import { registerAppLogo, registerRoute, registerSidebarEntry } from '@kinvolk/headlamp-plugin/lib';
import { SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Typography from '@mui/material/Typography';
import React from 'react';
import { EVOCLOUD_ICON } from './icons/evocloud';
import AppEndpoints from './pages/AppEndpoints';
import CrdSchemaDetail from './pages/CrdSchemaDetail';
import CrdSchemas from './pages/CrdSchemas';
import { CRD_SCHEMA_ROUTE, CRD_SCHEMAS_ROUTE } from './pages/crdSchemas/routes';
import { EvoCloudAppLogo } from './ui/AppLogo';

// Navbar logo. Branded while an EvoCloud theme is active; see AppLogo.tsx for
// why the other themes need an explicit fallback rather than a null return.
registerAppLogo(EvoCloudAppLogo);

// 1. Top-Level EvoCloud Parent Sidebar Item
registerSidebarEntry({
  parent: null,
  name: 'evocloud',
  label: 'EvoCloud',
  icon: EVOCLOUD_ICON,
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
  component: () => (
    <SectionBox title="EvoCloud Overview" textAlign="center" paddingTop={2}>
      <Typography>Welcome to the EvoCloud Platform Dashboard.</Typography>
      <Typography>ABCDEFGHIJKLMNOPQRSTUVWXYZ</Typography>
    </SectionBox>
  ),
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

// 4. Child Item: GitOps Delivery (Flux)
registerSidebarEntry({
  parent: 'evocloud',
  name: 'evocloud-gitops',
  label: 'GitOps Delivery',
  url: '/evocloud/gitops',
});

registerRoute({
  path: '/evocloud/gitops',
  sidebar: 'evocloud-gitops',
  name: 'evocloud-gitops',
  exact: true,
  component: () => (
    <SectionBox title="GitOps Delivery" textAlign="center" paddingTop={2}>
      <Typography>Manage declarative Flux deployments and Git repositories.</Typography>
    </SectionBox>
  ),
});

// 4. Child Item: Compliance & Policies (Kyverno)
registerSidebarEntry({
  parent: 'evocloud',
  name: 'evocloud-policies',
  label: 'Compliance Policies',
  url: '/evocloud/policies',
});

registerRoute({
  path: '/evocloud/policies',
  sidebar: 'evocloud-policies',
  name: 'evocloud-policies',
  exact: true,
  component: () => (
    <SectionBox title="Compliance Policies" textAlign="center" paddingTop={2}>
      <Typography>
        Monitor Kyverno cluster policies, benchmarks, and vulnerability scans.
      </Typography>
    </SectionBox>
  ),
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

// 6. Child Item: Networking & Observability (Cilium)
registerSidebarEntry({
  parent: 'evocloud',
  name: 'evocloud-networking',
  label: 'Networking & eBPF',
  url: '/evocloud/networking',
});

registerRoute({
  path: '/evocloud/networking',
  sidebar: 'evocloud-networking',
  name: 'evocloud-networking',
  exact: true,
  component: () => (
    <SectionBox title="Networking & eBPF Observability" textAlign="center" paddingTop={2}>
      <Typography>Cilium eBPF networking, security policies, and observability metrics.</Typography>
    </SectionBox>
  ),
});
