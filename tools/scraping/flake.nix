{
  description = "GEOS-FP and SVS scraping tools for the Earth Jukebox POC";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f (import nixpkgs { inherit system; }));
    in
    {
      devShells = forAll (pkgs: {
        default = pkgs.mkShell {
          buildInputs = with pkgs; [
            python3
            netcdf
            cdo
            python3Packages.requests
            python3Packages.pandas
            python3Packages.xarray
            python3Packages.netcdf4
          ];

          shellHook = ''
            echo "Earth Jukebox scraping environment"
            echo "Python: $(python3 --version)"
            echo "Run from tools/scraping/ (outputs go to ./resources/)."
          '';
        };
      });
    };
}
