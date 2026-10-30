import pathlib,subprocess,time,json,re,hashlib,zipfile,os,shutil,sys
root=pathlib.Path.cwd();probe=root/'probe';probe.mkdir(exist_ok=True);android=root/'apps/android';settings=android/'settings.gradle.kts';base=settings.read_text()
# Both profiles leave app optimization and keep rules untouched.
candidate=base.replace('pluginManagement {','pluginManagement {\n    plugins {\n        id("com.android.settings") version "9.5.0"\n    }',1)
pos=candidate.index('\ndependencyResolutionManagement')
candidate=candidate[:pos]+'''\nplugins {
    id("com.android.settings")
}

android {
    execution {
        profiles {
            create("local") {
                r8.runInSeparateProcess = false
            }
            create("ci") {
                r8 {
                    runInSeparateProcess = true
                    jvmOptions += listOf("-Xmx6g", "-XX:+UseParallelGC", "-Dfile.encoding=UTF-8")
                }
            }
            defaultProfile = "local"
        }
    }
}
''' + candidate[pos:]
(probe/'base-settings.gradle.kts').write_text(base);(probe/'candidate-settings.gradle.kts').write_text(candidate)
cpu=lambda:next(l.split(':',1)[1].strip() for l in pathlib.Path('/proc/cpuinfo').read_text().splitlines() if l.startswith('model name'))
meta=json.loads((probe/'results.json').read_text()) if (probe/'results.json').exists() else {'source':os.environ.get('SOURCE_SHA'),'labCommit':os.environ.get('GITHUB_SHA'),'cpuModel':cpu(),'logicalCpus':len(os.sched_getaffinity(0)),'runs':[]}
(probe/'cpuinfo.txt').write_text(pathlib.Path('/proc/cpuinfo').read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def build(label,variant,dry_run=False):
 settings.write_text(candidate if variant=='candidate' else base)
 folder=probe/label;folder.mkdir();model=cpu();assert model==meta['cpuModel']
 arguments='--no-daemon --console=plain --profile --info -Dorg.gradle.jvmargs="-Xmx6g -Dfile.encoding=UTF-8" -Pkotlin.daemon.jvmargs=-Xmx2g -Dcom.android.tools.r8.printtimes=true'
 if variant=='candidate':arguments+=' -Pandroid.settings.executionProfile=ci'
 if dry_run:arguments+=' --dry-run'
 tasks=':app:minifyReleaseWithR8 --rerun :app:assembleRelease -x :app:lintVitalRelease'
 command=['make','-C','apps/android','build','BUILD_TASKS='+tasks,'GRADLE_ARGUMENTS='+arguments]
 before=set((android/'build/reports/profile').glob('*.html'))
 started=time.perf_counter()
 with (folder/'gradle.log').open('w') as log:result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT)
 elapsed=time.perf_counter()-started
 text=(folder/'gradle.log').read_text();r8=re.search(r'^R8 [\d.]+: (\d+)ms',text,re.M)
 row={'label':label,'variant':variant,'wallSeconds':round(elapsed,3),'exitCode':result.returncode,'cpuModel':model,'r8InternalSeconds':int(r8[1])/1000 if r8 else None}
 config=android/'app/build/outputs/mapping/release/configuration.txt'
 if config.exists():shutil.copyfile(config,folder/'configuration.txt');row['configurationSha256']=sha(config)
 apks=list((android/'app/build/outputs/apk/release').glob('*.apk'))
 if apks:
  with zipfile.ZipFile(apks[0]) as z:row['apkEntryHashes']={n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.endswith('.dex') or n=='resources.arsc'}
 for path in (android/'build/reports/profile').glob('*.html'):
  if path not in before:shutil.copyfile(path,folder/path.name)
 meta['runs'].append(row);(probe/'results.json').write_text(json.dumps(meta,indent=2)+'\n')
 print(json.dumps(row),flush=True)
 if result.returncode:raise RuntimeError(f'{label} failed: {text[-4000:]}')
 if dry_run:return
 if r8 is None:raise RuntimeError('R8 must execute, never FROM-CACHE')
 if variant=='candidate' and not ('-XX:+UseParallelGC' in text and re.search(r'Starting process.*Gradle Worker Daemon',text)):
  raise RuntimeError('Missing separate R8 worker flags in --info output')
try:
 phase=sys.argv[1]
 if phase=='validate':build('validate-candidate','candidate',True)
 elif phase=='warmup':build('warmup-baseline','baseline');build('warmup-candidate','candidate')
 else:
  pair=int(phase.removeprefix('pair'));order=[['baseline','candidate'],['candidate','baseline'],['baseline','candidate']][pair-1]
  for variant in order:build(f'pair{pair}-{variant}',variant)
 measured=[r for r in meta['runs'] if r['label'].startswith('pair')]
 meta['pairs']=[]
 for pair in range(1,4):
  a=next((r for r in measured if r['label']==f'pair{pair}-baseline'),None);b=next((r for r in measured if r['label']==f'pair{pair}-candidate'),None)
  if a is None or b is None:continue
  meta['pairs'].append({'pair':pair,'baselineWallSeconds':a['wallSeconds'],'candidateWallSeconds':b['wallSeconds'],'savedSeconds':round(a['wallSeconds']-b['wallSeconds'],3),'sameConfiguration':a.get('configurationSha256')==b.get('configurationSha256'),'sameDexAndResources':a.get('apkEntryHashes')==b.get('apkEntryHashes')})
 meta['complete']=len(meta['pairs'])==3;(probe/'results.json').write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(meta['pairs'],indent=2),flush=True)
finally:settings.write_text(base)
