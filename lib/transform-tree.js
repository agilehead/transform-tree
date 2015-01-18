(function() {
    "use strict";

        /*
        visit = function*(obj, fn)
        Visits a data structure recursively, running transformation fn*(x) on each property.
        Returns a transformed data structure.
        Params:
            obj: Object to visit
            fn: Generator function which takes obj and returns a VisitResult
        //All fields are optional.
        VisitResult = {
            value: obj',
            stop: boolean
                Stop visiting this path?
            fnMustVisit: function*(key, obj) -> bool
                Generator function that returns a boolean whether a property (key) needs to be visited
            fnKey: function*(key) -> string
                Generator function that returns a new key name to use in transformed object
            visitProperties: array
                List of properties to visit. Otherwise all enumerable properties are visited.
                Will still obey fnMustVisit, if fnMustVisit exists.
            fnAfterVisit: function*(obj') -> object
                Transform the result again afer all properties have been visited.
            fn: function*(item) -> item'
                Function to use for visiting properties of current object.
                If missing, original fn is used.
        }
        Usage (from the Fora Project):
            yield* visit(
                match.requestContext.body,
                function*(item) {
                    if (item._mustReconstruct) {
                        var typeDefinition = yield* self.typesService.getTypeDefinition(item.type);
                        var model = yield* self.typesService.constructModelFromTypeDefinition(item, typeDefinition);
                        return { value: model, stop: true };
                    }
                }
            );
    */
    var visit = function*(obj, fn) {
        fn = fn || function*(o) { return { value: o }; };
        return yield* _visit(obj, fn, []);
    };

    var _visit = function*(obj, fn, visited) {
        var alreadyVisited;

        for(var vIndex = 0; vIndex < visited.length; vIndex++) {
            if (visited[vIndex].src === obj) {
                alreadyVisited = visited[vIndex];
                break;
            }
        }

        if(!alreadyVisited) {
            if (obj instanceof Array) {
                var newArray = [];
                for(var i = 0; i < obj.length; i++) {
                    newArray.push(yield* _visit(obj[i], fn, visited));
                }
                visited.push({ src: obj, dest: newArray });
                return newArray;
            } else {
                var visitResult = (yield* fn(obj)) || { value: obj };

                if (typeof(obj) === "object") {
                    var newObject = visitResult.value || {};

                    if (!visitResult.stop) {
                        var visitProperty = function*(key) {
                            if (!visitResult.fnMustVisit || (yield* visitResult.fnMustVisit(key, obj))) {
                                var newKey = visitResult.fnKey ? (yield* visitResult.fnKey(key)) : key;
                                if (newKey)
                                    newObject[newKey] = yield* _visit(obj[key], visitResult.fn || fn, visited);
                            }
                        };

                        if (visitResult.visitProperties) {
                            for (var iVP = 0; iVP < visitResult.visitProperties.length; iVP++) {
                                yield* visitProperty(visitResult.visitProperties[iVP]);
                            }
                        } else {
                            for (var key in obj) {
                                yield* visitProperty(key);
                            }
                        }
                    }

                    if (visitResult.fnAfterVisit)
                        newObject = yield* visitResult.fnAfterVisit(newObject);

                    visited.push({ src: obj, dest: newObject });

                    return newObject;

                } else {
                    return visitResult.value;
                }
            }
        } else {
            return alreadyVisited.dest;
        }
    };

    module.exports = visit;

})();
