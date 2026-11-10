# Homebrew Formula for SnippKit CLI (snix)
# Source Repository: https://github.com/Yaseen549/snippkit-cli
#
# To install:
#   brew install Yaseen549/tap/snix
#
# Repository structure on GitHub:
#   github.com/Yaseen549/homebrew-tap/Formula/snix.rb

class Snix < Formula
  desc "Official Terminal CLI for SnippKit & AI Agent Skills"
  homepage "https://snippkit.com"
  version "3.0.2"
  license "MIT"

  on_macos do
    url "https://snippkit.com/bin/snix-macos"
  end

  on_linux do
    url "https://snippkit.com/bin/snix-linux"
  end

  def install
    if OS.mac?
      bin.install "snix-macos" => "snix"
    elsif OS.linux?
      bin.install "snix-linux" => "snix"
    end
  end

  test do
    assert_match "snix", shell_output("#{bin}/snix --help")
  end
end

