"""Deployment orchestration tests. No AWS, Docker daemon, or database is used."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/deploy-ec2.sh"
SHA = "a" * 40

class DeploymentTests(unittest.TestCase):
    def run_deploy(self, *, current=SHA, fail=""):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".git").mkdir()
            (root / ".env").write_text("DATABASE_URL=fixture-only\n")
            bin_dir = root / "bin"
            bin_dir.mkdir()
            commands = {
                "git": '#!/bin/bash\nif [[ "$1" == rev-parse ]]; then echo "$CURRENT"; fi\n',
                "sudo": '#!/bin/bash\n[[ "$1" == -n ]] && shift\nexec "$@"\n',
                "docker": """#!/bin/bash
echo "$*" >> "$CALL_LOG"
if [[ "$FAIL_STAGE" == build && " $* " == *" build "* ]]; then exit 17; fi
if [[ "$FAIL_STAGE" == migrate && " $* " == *" run "* ]]; then exit 18; fi
if [[ "$FAIL_STAGE" == startup && " $* " == *" up "* && "${@: -1}" == api ]]; then exit 19; fi
""",
                "curl": '#!/bin/bash\necho curl >> "$CALL_LOG"\n[[ "$FAIL_STAGE" != health ]]\n',
            }
            for name, body in commands.items():
                path = bin_dir / name
                path.write_text(body)
                path.chmod(0o755)
            env = {**os.environ, "PATH": str(bin_dir) + ":" + os.environ["PATH"],
                   "CURRENT": current, "FAIL_STAGE": fail, "CALL_LOG": str(root / "calls")}
            result = subprocess.run(["bash", str(SCRIPT), SHA], cwd=root,
                                    env=env, text=True, capture_output=True)
            calls = (root / "calls").read_text() if (root / "calls").exists() else ""
            marker = (root / ".git/ec2-last-success").exists()
            return result, calls, marker

    def test_migration_failure_does_not_replace_api(self):
        result, calls, marker = self.run_deploy(fail="migrate")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("--wait-timeout 120 api", calls)
        self.assertFalse(marker)

    def test_build_failure_does_not_run_migrations(self):
        result, calls, marker = self.run_deploy(fail="build")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn(" run ", calls)
        self.assertFalse(marker)

    def test_stale_commit_does_nothing(self):
        result, calls, marker = self.run_deploy(current="b" * 40)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(calls, "")
        self.assertFalse(marker)

    def test_success_checks_health_after_migrations(self):
        result, calls, marker = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertLess(calls.index(" run "), calls.index("--wait-timeout 120 api"))
        self.assertTrue(calls.endswith("curl\n"))
        self.assertTrue(marker)

    def test_api_startup_failure_not_marked_successful(self):
        result, _, marker = self.run_deploy(fail="startup")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(marker)

    def test_health_failure_not_marked_successful(self):
        result, _, marker = self.run_deploy(fail="health")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(marker)

if __name__ == "__main__":
    unittest.main()
