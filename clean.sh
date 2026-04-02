#!/bin/sh
find . -name node_modules -type d -prune -exec rm -rf {} +
echo "All node_modules directories removed."
