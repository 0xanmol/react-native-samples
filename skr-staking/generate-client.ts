import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import anchorIdl from "./program/idl.json";

const codama = createFromRoot(rootNodeFromAnchor(anchorIdl));
codama.accept(renderVisitor("src/generated/staking"));