# Release config to the grants platform

## Specifying a new release

1. Create a copy of the `release.example.yml` file, calling it `release.yml`.
2. Edit the `release.yml` file to specify the grant you want to release and where to.
3. Set the status to active to indicate that the config version is live for that environment
4. Set the status to draft to indicate that the config version is 'sandboxed' for that environment
5. Set the status to none to not deploy this version to that environment
6. Add some notes about the release
7. Create a pull request with just this change in it
8. After review, merge to main
9. The release will be deployed to the grants platform across all environments excluding production
10. To deploy to production, set the status to active and merge to main, raise an RFC, and then deploy the config broker version to production manually

## Statuses

- active: Indicates that the config version is live for that environment
- draft: Indicates that the config version is 'sandboxed' for that environment
- none: Indicates that the config version should not be deployed to that environment

Currently, you can freely move versions between active and draft status on a given environment. There is no support to
remove a config version from a given environment. Once deployed out, you can't change a version, but you can change it's
status back to draft with a subsequent release to make it 'not live'.

For now, create a new file called release, based on release.example.yml.

## Limitations

- Only one grant, and one version per release
- There is no way to remove a grant config version from an environment

## Release a completely new grant

To onboard release of a new grant, create a repository to hold the config for the grant, and
ensure you set up semantic versioning there. Update the `.github/grant-locations.yml` file
to include the new grant. Then you can release as normal, by creating a new release.yml file.
