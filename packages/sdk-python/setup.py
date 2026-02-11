from setuptools import setup, find_packages

setup(
    name="mockmail-sdk",
    version="1.0.0",
    description="Official MockMail.dev SDK for Python",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=["requests>=2.25.0"],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)
