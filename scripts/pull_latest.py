import subprocess
import os

os.chdir('/vercel/share/v0-project')

try:
    result = subprocess.run(['git', 'pull', 'origin', 'main'], capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("Stderr:", result.stderr)
    print("Pull completed successfully!")
except Exception as e:
    print(f"Error: {e}")
