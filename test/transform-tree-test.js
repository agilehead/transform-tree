(function() {

    "use strict";

    var co = require('co');
    var assert = require('assert');

    describe("Ceramic Core", function() {
        var Author, BlogPost;
        var authorSchema, postSchema;
        var Ceramic;

        before(function() {
            return co(function*() {
                Ceramic = require("../lib/ceramic");

                Author = function(params) {
                    if (params) {
                        for(var key in params) {
                            this[key] = params[key];
                        }
                    }
                };

                authorSchema = {
                    ctor: Author,
                    schema: {
                        id: 'author',
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            location: { type: 'string' },
                            age: { type: 'number' }
                        },
                        required: ['name', 'location']
                    }
                };

                BlogPost = function(params) {
                    if (params) {
                        for(var key in params) {
                            this[key] = params[key];
                        }
                    }
                };

                postSchema = {
                    ctor: BlogPost,
                    schema: {
                        id: 'post',
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            content: { type: 'string' },
                            published: { type: 'string' },
                            author: { $ref: 'author' }
                        },
                        required: ['title', 'content', 'author']
                    }
                };

            });
        });


        it("completeEntitySchema must complete the entitySchema", function() {
            return co(function*() {
                var songSchema = {
                    schema: {
                        id: 'song',
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            artist: { type: 'string' },
                            price: { type: 'number' }
                        },
                        required: ['title', 'artist']
                    }
                };

                var ceramic = new Ceramic();
                var entitySchema = yield ceramic.completeEntitySchema(songSchema);
                assert.notEqual(entitySchema, null);
                assert.equal(entitySchema.schema.required.length, 2);
            });
        });


        it("completeVirtualEntitySchema must complete the virtualEntitySchema", function() {
            return co(function*() {
                var songSchema = {
                    schema: {
                        id: 'song',
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            artist: { type: 'string' },
                            price: { type: 'number' }
                        },
                        required: ['title', 'artist']
                    }
                };

                var mp3Schema = {
                    schema: {
                        id: 'mp3',
                        properties: {
                            bitrate: { type: 'number' }
                        },
                        required: ['bitrate']
                    }
                };

                var ceramic = new Ceramic();
                var entitySchema = yield ceramic.completeVirtualEntitySchema(mp3Schema, songSchema);
                assert.equal(entitySchema.schema.required.length, 3);
            });
        });


        it("init must create a schema cache", function() {
            return co(function*() {
                var ceramic = new Ceramic();
                var schemaCache = yield ceramic.init([authorSchema, postSchema]);
                assert.equal(Object.keys(schemaCache).length, 2);
            });
        });


        it("constructEntity must construct a model", function() {
            return co(function*() {
                var ceramic = new Ceramic();
                var schemaCache = yield ceramic.init([authorSchema, postSchema]);
                var blogPostJSON = {
                    title: "Busy Being Born",
                    content: "The days keep dragging on, Those rats keep pushing on,  The slowest race around, We all just race around ...",
                    published: "yes",
                    author: {
                        name: "Middle Class Rut",
                        location: "USA",
                    }
                };
                var blogPost = yield ceramic.constructEntity(blogPostJSON, postSchema);
                assert.equal(blogPost instanceof BlogPost, true, "blogPost must be an instanceof BlogPost");
                assert.equal(blogPost.author instanceof Author, true, "blogPost must be an instanceof Author");
            });
        });


        it("constructEntity must construct a model with virtual-schema", function() {
            return co(function*() {
                var songSchema = {
                    discriminator: function*(obj, ceramic) {
                        return yield ceramic.getEntitySchema(obj.type);
                    },
                    schema: {
                        id: 'song',
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            artist: { type: 'string' },
                            price: { type: 'number' },
                            type: { type: 'string' }
                        },
                        required: ['title', 'artist']
                    }
                };

                var mp3Schema = {
                    schema: {
                        id: "mp3",
                        properties: {
                            bitrate: { type: 'number' }
                        },
                        required: ['bitrate']
                    }
                };

                var youtubeVideoSchema = {
                    schema: {
                        id: "youtube",
                        properties: {
                            url: { type: 'string' },
                            highDef: { type: 'boolean' }
                        },
                        required: ['url', 'highDef']
                    }
                };

                var ceramic = new Ceramic();
                var schemaCache = yield ceramic.init(
                    [songSchema], //schemas
                    [
                        {
                            entitySchemas: [mp3Schema, youtubeVideoSchema],
                            baseEntitySchema: songSchema
                        }
                    ] //virtual-schemas
                );

                var mp3JSON = {
                    "type": "mp3",
                    "title": "Busy Being Born",
                    "artist": "Middle Class Rut",
                    "bitrate": 320
                };

                var mp3 = yield ceramic.constructEntity(mp3JSON, songSchema, { validate: true });
                assert.equal(mp3.bitrate, 320);
            });
        });


        it("updateEntity must update a model", function() {
            return co(function*() {
                var blogPost = new BlogPost({
                    title: "---",
                    content: "---"
                });
                var ceramic = new Ceramic();
                var schemaCache = yield ceramic.init([authorSchema, postSchema]);
                var blogPostJSON = {
                    title: "Busy Being Born",
                    content: "The days keep dragging on, Those rats keep pushing on,  The slowest race around, We all just race around ...",
                    published: "yes",
                    author: {
                        name: "Middle Class Rut",
                        location: "USA",
                    }
                };
                yield ceramic.updateEntity(blogPost, blogPostJSON, postSchema);
                assert.equal(blogPost instanceof BlogPost, true, "blogPost must be an instanceof BlogPost");
                assert.equal(blogPost.author instanceof Author, true, "blogPost must be an instanceof Author");
                assert.equal(blogPost.title, "Busy Being Born", "blogPost.title must be Busy Being Born");
            });
        });


        it("validate must return an error for the missing author field", function() {
            return co(function*() {
                var ceramic = new Ceramic();
                var typeCache = yield ceramic.init([authorSchema, postSchema]);
                var blogPost = new BlogPost({
                    title: "---",
                    content: "---"
                });
                var errors = yield ceramic.validate(blogPost, postSchema);
                //Missing author
                assert.equal(errors[0].constraintName, 'required');
            });
        });


        it("validate must return an error for the mismatched author field type", function() {
            return co(function*() {
                var ceramic = new Ceramic();
                var typeCache = yield ceramic.init([authorSchema, postSchema]);
                var blogPost = new BlogPost({
                    title: "Ceramic Documentation",
                    content: "See README.MD...",
                    author: "jeswin"
                });
                var errors = yield ceramic.validate(blogPost, postSchema);
                //author field breaks the type constraint
                assert.equal(errors[0].constraintName, 'type');
            });
        });


        it("validate must return no errors for correct schema", function() {
            return co(function*() {
                var ceramic = new Ceramic();
                var typeCache = yield ceramic.init([authorSchema, postSchema]);
                var blogPost = new BlogPost({
                    title: "Busy Being Born",
                    content: "The days keep dragging on, Those rats keep pushing on,  The slowest race around, We all just race around ...",
                    published: "yes",
                    author: new Author({
                        name: "jeswin",
                        location: "bangalore"
                    })
                });
                var errors = yield ceramic.validate(blogPost, postSchema);
                assert.equal(errors, undefined);
            });
        });



        it("load a dynamic schema", function() {
            return co(function*() {
                var songSchema = {
                    schema: {
                        id: "song",
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            artist: { type: 'string' },
                            price: { type: 'number' },
                            torrent: { $ref: 'torrent' }
                        },
                        required: ['title', 'artist']
                    }
                };

                var torrentSchema = {
                    schema: {
                        id: "torrent",
                        type: "object",
                        properties: {
                            fileName: { type: 'string' },
                            seeds: { type: 'number' },
                            leeches: { type: 'number' }
                        },
                        required: ['fileName', 'seeds', 'leeches']
                    }
                };

                var dynamicLoader = function*(name, dynamicResolutionContext) {
                    switch(name) {
                        case "torrent":
                            return yield ceramic.completeEntitySchema(torrentSchema);
                    }
                };

                var ceramic = new Ceramic({
                    fn: { getDynamicEntitySchema: dynamicLoader }
                });

                //song schema references torrent schema, but is not provided during init.
                var schemaCache = yield ceramic.init([songSchema]);

                var songJSON = {
                    title: "Busy Being Born",
                    artist: "Middle Class Rut",
                    price: 10,
                    torrent: {
                        fileName: "busy-being-born.mp3",
                        seeds: 1000,
                        leeches: 1100
                    }
                };

                var mp3 = yield ceramic.constructEntity(songJSON, songSchema, { validate: true });
                assert.equal(mp3.torrent.fileName, "busy-being-born.mp3");
            });
        });

    });

})();
