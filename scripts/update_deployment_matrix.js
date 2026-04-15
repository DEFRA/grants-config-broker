import fs from 'fs';
import yaml from 'js-yaml';
import semver from 'semver';

function upsertVersion(array, newItem) {
  const index = array.findIndex(item => item.number === newItem.number);

  if (index !== -1) {
    array[index] = { ...array[index], ...newItem };
  } else {
    array.push(newItem);
  }
}

function createNewGrantEntry(name, grants) {
  const newGrant = {
    name,
    envs: [
      { name: 'dev', versions: [] },
      { name: 'test', versions: []},
      { name: 'ext-test', versions: []},
      { name: 'perf-test', versions: []},
      { name: 'prod', versions: []},
    ]
  };
  grants.push(newGrant);
  return newGrant;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function normaliseReleases(releaseData, releaseFile) {
  if (Array.isArray(releaseData.releases)) {
    return releaseData.releases;
  }

  if (releaseData.name && releaseData.version) {
    return [
      {
        name: releaseData.name,
        version: releaseData.version,
        environments: releaseData.environments || []
      }
    ];
  }

  fail(`Invalid format in ${releaseFile}`);
}

function main() {
  const releaseFile = 'release/release.yml';
  const matrixFile = 'release/deployment-matrix.yml';
  if (!fs.existsSync(releaseFile) || !fs.existsSync(matrixFile)) {
    console.log(`Files ${releaseFile} / ${matrixFile} not found, unable to update deployment matrix`);
    process.exit(0);
  }

  let releaseData;
  let matrixData;
  try {
    releaseData = yaml.load(fs.readFileSync(releaseFile, 'utf8'));
    matrixData = yaml.load(fs.readFileSync(matrixFile, 'utf8'));
  } catch (e) {
    fail(`Error parsing input files: ${e.message}`);
  }

  const releases = normaliseReleases(releaseData, releaseFile);

  const grants = matrixData.grants || [];

  for (const release of releases) {
    const { name, version, environments = [] } = release;

    if (!name || !version) {
      fail(`Each release must contain 'name' and 'version'`);
    }

    // find or create grant
    const grant =
      grants.find(g => g.name === name) ??
      createNewGrantEntry(name, grants);

    for (const eachEnv of environments) {
      if (eachEnv.status === 'none') continue;

      let matrixEnvEntry = grant.envs.find(env => env.name === eachEnv.name);

      if (!matrixEnvEntry) {
        matrixEnvEntry = { name: eachEnv.name, versions: [] };
        grant.envs.push(matrixEnvEntry);
      }

      upsertVersion(matrixEnvEntry.versions, {
        number: version,
        status: eachEnv.status
      });

      matrixEnvEntry.versions.sort((a, b) => semver.rcompare(a.number, b.number));
    }
  }

  matrixData.grants = grants;

  matrixData.lastUpdated = ((d) => `${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}_${String(d.getDate()).padStart(2, '0')}__${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`)(new Date());
  try {
    fs.writeFileSync(matrixFile, yaml.dump(matrixData));
  } catch (e) {
    fail(`Error writing output file: ${e.message}`);
  }
}

main();
