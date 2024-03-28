const esbuild = require("esbuild");
const copyPlugin = require("esbuild-plugin-copy");

const watchFlag = process.argv.indexOf("--watch") > -1;
const minifyFlag = process.argv.indexOf("--minify") > -1;

const opts = {
	entryPoints: ["src/script.js", "src/sw.ts"],
	bundle: true,
	outdir: "dist",
	bundle: true,
	minify: minifyFlag,
	sourcemap: minifyFlag ? false : "both",
	loader: {
		".woff": "file",
		".woff2": "file",
	},
	plugins: [
		copyPlugin.copy({
			assets: [
				{ from: ["./src/index.html"], to: ["./index.html"] },
				{ from: ["./src/style.css"], to: ["./style.css"] },
				{ from: ["./src/icons/*"], to: ["./icons"] },
			],
		}),
	],
};

if (watchFlag) {
	esbuild.context(opts).then(async (ctx) => {
		const { host, port } = await ctx.serve({
			servedir: "dist",
		});
		console.log(`Serving on ${host}:${port}`);
	});
} else {
	esbuild.build(opts);
}
