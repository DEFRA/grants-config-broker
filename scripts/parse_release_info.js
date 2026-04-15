import fs from 'fs';
import yaml from 'js-yaml';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  const releaseFile = 'release/release.yml';
  if (!fs.existsSync(releaseFile)) {
    console.log(`No ${releaseFile} found, returning []`);
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `grants=[]\n`);
    }
    process.exit(0);
  }

  let releaseData;
  try {
    releaseData = yaml.load(fs.readFileSync(releaseFile, 'utf8'));
  } catch (e) {
    fail(`Error parsing ${releaseFile}: ${e.message}`);
  }

  let releases = [];

  if (Array.isArray(releaseData.releases)) {
    releases = releaseData.releases;
  } else if (releaseData.name && releaseData.version) {
    releases = [
      {
        name: releaseData.name,
        version: releaseData.version
      }
    ];
  } else {
    fail(`Invalid format in ${releaseFile}. Require either {name, version} or {releases: []}`);
  }

  const locationsFile = '.github/grant-locations.yml';
  if (!fs.existsSync(locationsFile)) {
    fail(`File ${locationsFile} not found`);
  }

  let locationsData;
  try {
    locationsData = yaml.load(fs.readFileSync(locationsFile, 'utf8'));
  } catch (e) {
    fail(`Error parsing ${locationsFile}: ${e.message}`);
  }

  const repositories = locationsData.repositories || [];

  const result = releases.map(({ name, version }) => {
    if (!name || !version) {
      fail(`Each release must contain 'name' and 'version'`);
    }

    const repo = repositories.find(r => r.name === name);

    if (!repo) {
      fail(`Repository for '${name}' not found in ${locationsFile}`);
    }

    return {
      name,
      version,
      repository: repo.repository,
      directory: repo.path
    };
  });

  const jsonOutput = JSON.stringify(result);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `grants=${jsonOutput}\n`);
  }

  console.log(jsonOutput);
}

main();
