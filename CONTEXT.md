# grants-config-broker

A grants configuration broker that serves versioned grant configuration and publishes release notifications.

## Language

**Config broker**
The service that reads grant configuration from storage and exposes version, history, and release APIs.
_Avoid_: Grants UI, Config repository, Static file server

**Grant configuration**
The files that define a grant's UI, integration, and release payload.
_Avoid_: Application state, User answers, Runtime settings

**Grant**
A configured funding programme whose configuration can have multiple versions and statuses.
_Avoid_: Product, Tenant, Form

**Version**
A semver-style identifier for a released set of grant configuration files.
_Avoid_: Build number, Commit SHA, Timestamp

**Status**
The broker's release state for a version, such as `draft` or `active`.
_Avoid_: Application status, HTTP status, Test status

**Manifest**
The list of configuration file paths that make up a released version.
_Avoid_: Sitemap, Index page, Package lock

**Release config**
The API payload used to publish or update a grant configuration version.
_Avoid_: Deployment, Form submission, Seed data

**Config update notification**
The SNS message emitted when a version is released or its status changes.
_Avoid_: Webhook unless discussing the transport, Audit event, User notification

**Localstack**
The local AWS-compatible environment used for S3 and SNS development.
_Avoid_: Production AWS, MockServer, Docker Compose itself
